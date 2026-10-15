import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { createHash } from "crypto";
import { authPublicRoutes } from "../auth-public.js";

// Mock the database module
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  systemSettings: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

// Mock email service
vi.mock("../../services/email/index.js", () => ({
  emailService: {
    sendPasswordResetEmail: vi.fn(() => Promise.resolve({ success: true })),
    sendVerificationEmail: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

// Mock password validation
vi.mock("../../services/password-validation.js", () => ({
  validatePassword: vi.fn((password: string) => {
    // Simulate: weak passwords fail, strong ones pass
    const isStrong =
      password.length >= 12 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password);
    return Promise.resolve({
      valid: isStrong,
      errors: isStrong ? [] : ["Password must be at least 12 characters"],
    });
  }),
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(() => Promise.resolve(false)),
    hash: vi.fn(() => Promise.resolve("$2a$12$hashedpassword")),
  },
}));

// Mock session cache invalidation (auth middleware pulls in Redis + timers)
const { mockInvalidateSessionCache } = vi.hoisted(() => ({
  mockInvalidateSessionCache: vi.fn(),
}));
vi.mock("../../middleware/auth.js", () => ({
  invalidateSessionCache: mockInvalidateSessionCache,
}));

// Mock OAuth providers
vi.mock("../oauth-providers.js", () => ({
  getOAuthConfig: vi.fn(() => Promise.resolve({})),
}));

// Mock rate limit middleware (returns empty config so it doesn't block tests)
vi.mock("../../middleware/rate-limit.js", () => ({
  getAuthRateLimit: vi.fn(() => ({})),
}));

describe("Auth Public API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await authPublicRoutes(app, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // POST /api/auth/forgot-password
  // ==========================================================================
  describe("POST /api/auth/forgot-password", () => {
    it("returns success even for non-existent email (no user enumeration)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/forgot-password",
        payload: { email: "nonexistent@example.com" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);
      expect(body.data.message).toContain("If an account exists");
    });

    it("returns success for existing user and saves reset token", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        name: "Test User",
        passwordHash: "$2a$12$existinghash",
      });
      mockPrisma.user.update.mockResolvedValue({});

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/forgot-password",
        payload: { email: "user@example.com" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);

      // Verify a reset token hash was saved
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            resetTokenHash: expect.any(String),
            resetTokenExpiry: expect.any(Date),
          }),
        }),
      );
    });

    it("returns success for OAuth-only user (no password hash)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-oauth",
        email: "oauth@example.com",
        name: "OAuth User",
        passwordHash: null,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/forgot-password",
        payload: { email: "oauth@example.com" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);
      // Should NOT attempt to save a token for OAuth-only users
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("returns 400 when email is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/forgot-password",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Email is required");
    });
  });

  // ==========================================================================
  // POST /api/auth/verify-reset-token
  // ==========================================================================
  describe("POST /api/auth/verify-reset-token", () => {
    it("rejects invalid/expired tokens", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/verify-reset-token",
        payload: { token: "invalid-token-abc123" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Invalid or expired reset token");
    });

    it("returns valid with masked email for valid token", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/verify-reset-token",
        payload: { token: "valid-token-abc123" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.valid).toBe(true);
      // Email should be masked (e.g., "te***@example.com")
      expect(body.data.email).not.toBe("test@example.com");
      expect(body.data.email).toContain("***");
    });

    it("returns 400 when token is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/verify-reset-token",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Token is required");
    });
  });

  // ==========================================================================
  // POST /api/auth/reset-password
  // ==========================================================================
  describe("POST /api/auth/reset-password", () => {
    it("rejects invalid/expired tokens", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: { token: "expired-token", password: "StrongPass123!!" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Invalid or expired reset token");
    });

    it("rejects weak passwords", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: { token: "valid-token", password: "weak" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Invalid password");
    });

    it("succeeds with valid token and strong password", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        passwordHash: "$2a$12$oldhash",
      });
      mockPrisma.user.update.mockResolvedValue({});

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: { token: "valid-token", password: "NewStrongPass123" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);

      // Verify password was updated and token hash cleared
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            passwordHash: expect.any(String),
            resetTokenHash: null,
            resetTokenExpiry: null,
          }),
        }),
      );
    });

    it("ends existing sessions: stamps passwordChangedAt and drops the session cache", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        passwordHash: "$2a$12$oldhash",
      });
      mockPrisma.user.update.mockResolvedValue({});
      const before = Date.now();

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: { token: "valid-token", password: "NewStrongPass123" },
      });

      expect(response.statusCode).toBe(200);
      const data = mockPrisma.user.update.mock.calls[0][0].data;
      expect(data.passwordChangedAt).toBeInstanceOf(Date);
      expect(data.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(mockInvalidateSessionCache).toHaveBeenCalledWith("user-1");
    });

    it("clears a lockout", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        passwordHash: "$2a$12$oldhash",
        status: "LOCKED",
      });
      mockPrisma.user.update.mockResolvedValue({});

      await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: { token: "valid-token", password: "NewStrongPass123" },
      });

      expect(mockPrisma.user.update.mock.calls[0][0].data).toMatchObject({
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: "ACTIVE",
      });
    });

    it("returns 400 when token is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: { password: "StrongPass123!!" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Token is required");
    });

    it("returns 400 when password is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: { token: "valid-token" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Password is required");
    });

    it("rejects same password as current", async () => {
      // Import bcrypt mock to make compare return true for this test
      const bcrypt = await import("bcryptjs");
      (
        bcrypt.default.compare as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(true);

      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        passwordHash: "$2a$12$existinghash",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: { token: "valid-token", password: "SamePassword123!" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Password unchanged");
    });
  });

  // ==========================================================================
  // POST /api/auth/verify-email
  // ==========================================================================
  // ==========================================================================
  // Email verification tokens are stored as sha256:<hex>, never plaintext
  // ==========================================================================
  describe("email verification token storage", () => {
    const sha = (t: string) =>
      "sha256:" + createHash("sha256").update(t).digest("hex");

    it("resend stores only the hash; the email carries the plaintext", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        name: "User",
        emailVerified: null,
      });
      mockPrisma.user.update.mockResolvedValue({});
      const { emailService } = await import("../../services/email/index.js");

      await app.inject({
        method: "POST",
        url: "/api/auth/resend-verification",
        payload: { email: "user@example.com" },
      });

      const stored = mockPrisma.user.update.mock.calls[0][0].data
        .verificationToken as string;
      const sent = (
        emailService.sendVerificationEmail as ReturnType<typeof vi.fn>
      ).mock.calls[0][2] as string;
      expect(stored).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(sent).not.toContain("sha256:");
      expect(stored).toBe(sha(sent));
    });

    it.each(["/api/auth/verify-email", "/api/auth/verification-status"])(
      "%s looks the token up by hash, accepting an unexpired legacy plaintext row",
      async (url) => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        await app.inject({ method: "POST", url, payload: { token: "abc123" } });

        const where = mockPrisma.user.findFirst.mock.calls[0][0].where;
        expect(where.verificationToken).toEqual({
          in: [sha("abc123"), "abc123"],
        });
        expect(where.verificationTokenExpiry).toEqual({ gt: expect.any(Date) });
      },
    );

    it.each(["/api/auth/verify-email", "/api/auth/verification-status"])(
      "%s never matches a stored hash submitted as the token",
      async (url) => {
        mockPrisma.user.findFirst.mockResolvedValue(null);
        const leakedHash = sha("abc123");

        await app.inject({
          method: "POST",
          url,
          payload: { token: leakedHash },
        });

        const where = mockPrisma.user.findFirst.mock.calls[0][0].where;
        expect(where.verificationToken).toEqual({ in: [sha(leakedHash)] });
      },
    );
  });

  describe("POST /api/auth/verify-email", () => {
    it("rejects invalid/expired verification tokens", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/verify-email",
        payload: { token: "invalid-verification-token" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Invalid or expired verification link");
    });

    it("succeeds with valid verification token", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        emailVerified: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/verify-email",
        payload: { token: "valid-verification-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);
      expect(body.data.message).toContain("verified successfully");

      // Verify token was cleared and emailVerified was set
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            emailVerified: expect.any(Date),
            verificationToken: null,
            verificationTokenExpiry: null,
          }),
        }),
      );
    });

    it("activates an account that registration left pending", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        emailVerified: null,
        status: "PENDING_VERIFICATION",
      });
      mockPrisma.user.update.mockResolvedValue({});

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/verify-email",
        payload: { token: "valid-verification-token" },
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.user.update.mock.calls[0][0].data.status).toBe(
        "ACTIVE",
      );
    });

    it("leaves a suspended account's status alone", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        emailVerified: null,
        status: "SUSPENDED",
      });
      mockPrisma.user.update.mockResolvedValue({});

      await app.inject({
        method: "POST",
        url: "/api/auth/verify-email",
        payload: { token: "valid-verification-token" },
      });

      expect(mockPrisma.user.update.mock.calls[0][0].data).not.toHaveProperty(
        "status",
      );
    });

    it("returns success with alreadyVerified flag if email is already verified", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        emailVerified: new Date("2025-01-01"),
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/verify-email",
        payload: { token: "valid-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);
      expect(body.data.alreadyVerified).toBe(true);
      // Should NOT update the user if already verified
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("returns 400 when token is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/verify-email",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Token is required");
    });
  });

  // ==========================================================================
  // POST /api/auth/resend-verification
  // ==========================================================================
  describe("POST /api/auth/resend-verification", () => {
    it("returns success even for non-existent email (no user enumeration)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/resend-verification",
        payload: { email: "nonexistent@example.com" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);
      expect(body.data.message).toContain("If an unverified account exists");
    });

    it("returns success for already verified email (no enumeration)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "verified@example.com",
        name: "Verified User",
        emailVerified: new Date("2025-01-01"),
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/resend-verification",
        payload: { email: "verified@example.com" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);
      // Should NOT generate a new token for already verified users
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("generates and saves verification token for unverified user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "unverified@example.com",
        name: "Unverified User",
        emailVerified: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/resend-verification",
        payload: { email: "unverified@example.com" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);

      // Verify token was saved
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            verificationToken: expect.any(String),
            verificationTokenExpiry: expect.any(Date),
          }),
        }),
      );
    });

    it("returns 400 when email is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/resend-verification",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Email is required");
    });
  });

  // ==========================================================================
  // POST /api/auth/verification-status
  // ==========================================================================
  describe("POST /api/auth/verification-status", () => {
    it("returns valid:false for invalid token", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/verification-status",
        payload: { token: "invalid-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.valid).toBe(false);
    });

    it("returns valid:true with masked email for valid token", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        emailVerified: null,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/verification-status",
        payload: { token: "valid-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.valid).toBe(true);
      expect(body.data.email).toContain("***");
      expect(body.data.alreadyVerified).toBe(false);
    });

    it("returns 400 when token is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/verification-status",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Token is required");
    });
  });
});
