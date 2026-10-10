/**
 * POST /api/auth/credentials: the password sign-in check behind the
 * Next.js credentials provider (lockout, status, two-factor).
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";

const mockPrisma = {
  user: { findUnique: vi.fn(), update: vi.fn() },
  systemSettings: { findFirst: vi.fn() },
};
vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

const { mockVerifyTotp } = vi.hoisted(() => ({ mockVerifyTotp: vi.fn() }));
vi.mock("../../services/two-factor.js", () => ({
  decryptSecret: vi.fn(() => "secret"),
  verifyTOTPCode: mockVerifyTotp,
  getBackupCodesFromStorage: vi.fn(() => ["hashed-a", "hashed-b"]),
  verifyBackupCode: vi.fn((code: string) => (code === "AAAA-BBBB" ? 1 : -1)),
  storeHashedBackupCodes: vi.fn((codes: string[]) => `stored:${codes.join()}`),
}));

const { credentialsRoutes } = await import(
  "../auth-public/routes/credentials.js"
);

const PASSWORD = "Correct-Horse-9";
let passwordHash: string;

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    email: "user@example.com",
    name: "User",
    image: null,
    avatarUrl: null,
    passwordHash,
    status: "ACTIVE",
    failedLoginAttempts: 0,
    lockedUntil: null,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: null,
    ...overrides,
  };
}

describe("POST /api/auth/credentials", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 4);
    app = Fastify();
    await app.register(credentialsRoutes);
    await app.ready();
  });
  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    // Stand-in for the database's atomic counter, starting from 0.
    let counter = 0;
    mockPrisma.user.update.mockImplementation(
      async ({
        data,
      }: {
        data: { failedLoginAttempts?: number | { increment: number } };
      }) => {
        const f = data.failedLoginAttempts;
        const inc = typeof f === "object" ? f.increment : undefined;
        if (inc) counter += inc;
        return { failedLoginAttempts: counter };
      },
    );
    mockPrisma.systemSettings.findFirst.mockResolvedValue({
      maxLoginAttempts: 3,
      lockoutDurationMinutes: 15,
    });
  });

  function signIn(body: Record<string, unknown>) {
    return app.inject({
      method: "POST",
      url: "/api/auth/credentials",
      payload: { email: "user@example.com", password: PASSWORD, ...body },
    });
  }

  it("returns the user and resets counters on success", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      user({ failedLoginAttempts: 2 }),
    );
    const res = await signIn({ email: " USER@example.com " });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({
      id: "u1",
      email: "user@example.com",
    });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
    expect(mockPrisma.user.update.mock.calls[0][0].data).toMatchObject({
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  });

  it("rejects an unknown email after a password-hash comparison", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const compare = vi.spyOn(bcrypt, "compare");
    const res = await signIn({});
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("invalid_credentials");
    expect(compare).toHaveBeenCalled();
    compare.mockRestore();
  });

  it("counts a wrong password and locks at the limit", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      user({ failedLoginAttempts: 2 }),
    );
    mockPrisma.user.update.mockResolvedValueOnce({ failedLoginAttempts: 3 });
    const res = await signIn({ password: "wrong" });
    expect(res.json().code).toBe("account_locked");
    const data = mockPrisma.user.update.mock.calls[1][0].data;
    expect(data.lockedUntil).toBeInstanceOf(Date);
    expect(data.failedLoginAttempts).toBe(0);
    expect(data.status).toBeUndefined();
  });

  it("increments atomically when guesses arrive in parallel", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user());
    const [a, b] = await Promise.all([
      signIn({ password: "wrong" }),
      signIn({ password: "wrong" }),
    ]);
    expect(a.json().code).toBe("invalid_credentials");
    expect(b.json().code).toBe("invalid_credentials");
    const datas = mockPrisma.user.update.mock.calls.map((c) => c[0].data);
    expect(datas).toEqual([
      { failedLoginAttempts: { increment: 1 } },
      { failedLoginAttempts: { increment: 1 } },
    ]);
  });

  it("refuses while locked, even with the right password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      user({ lockedUntil: new Date(Date.now() + 60_000) }),
    );
    expect((await signIn({})).json().code).toBe("account_locked");
  });

  it("lets an old LOCKED account in once the lock has expired", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      user({ status: "LOCKED", lockedUntil: new Date(Date.now() - 1000) }),
    );
    const res = await signIn({});
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.user.update.mock.calls[0][0].data.status).toBe("ACTIVE");
  });

  it("reveals unverified or disabled status only with the right password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      user({ status: "PENDING_VERIFICATION" }),
    );
    expect((await signIn({ password: "wrong" })).json().code).toBe(
      "invalid_credentials",
    );
    expect((await signIn({})).json().code).toBe("email_unverified");

    mockPrisma.user.findUnique.mockResolvedValue(user({ status: "SUSPENDED" }));
    expect((await signIn({})).json().code).toBe("account_disabled");
  });

  describe("with two-factor enabled", () => {
    const twoFactorUser = () =>
      user({
        twoFactorEnabled: true,
        twoFactorSecret: "enc",
        twoFactorBackupCodes: "enc",
      });

    it("asks for a code after the right password", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(twoFactorUser());
      expect((await signIn({})).json().code).toBe("two_factor_required");
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("accepts a valid authenticator code", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(twoFactorUser());
      mockVerifyTotp.mockReturnValue(true);
      expect((await signIn({ code: "123456" })).statusCode).toBe(200);
    });

    it("accepts a backup code once and stores the rest", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(twoFactorUser());
      mockVerifyTotp.mockReturnValue(false);
      expect((await signIn({ code: "AAAA-BBBB" })).statusCode).toBe(200);
      expect(
        mockPrisma.user.update.mock.calls[0][0].data.twoFactorBackupCodes,
      ).toBe("stored:hashed-a");
    });

    it("counts a wrong code toward the lockout", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(twoFactorUser());
      mockVerifyTotp.mockReturnValue(false);
      const res = await signIn({ code: "000000" });
      expect(res.json().code).toBe("invalid_two_factor_code");
      expect(mockPrisma.user.update.mock.calls[0][0].data).toEqual({
        failedLoginAttempts: { increment: 1 },
      });
    });
  });
});
