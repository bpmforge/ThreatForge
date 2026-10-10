/**
 * Guest Access API Tests
 *
 * Tests for guest access management:
 * - Grant guest access
 * - List guest access
 * - Revoke guest access
 * - Validate access token
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
import Fastify, { FastifyInstance } from "fastify";
import { guestAccessRoutes } from "../guest-access.js";

const mockUser = { id: "user-1", email: "test@example.com", name: "Test User" };

// Mock guest access service
vi.mock("../../services/guest-access/guest-access-service.js", () => ({
  grantGuestAccess: vi.fn(),
  revokeGuestAccess: vi.fn(),
  listModelGuestAccess: vi.fn(),
  validateAccessToken: vi.fn(),
  isValidTokenFormat: vi.fn(),
}));

import {
  grantGuestAccess,
  revokeGuestAccess,
  listModelGuestAccess,
  validateAccessToken,
  isValidTokenFormat,
} from "../../services/guest-access/guest-access-service.js";

const mockGrant = grantGuestAccess as ReturnType<typeof vi.fn>;
const mockRevoke = revokeGuestAccess as ReturnType<typeof vi.fn>;
const mockList = listModelGuestAccess as ReturnType<typeof vi.fn>;
const mockValidate = validateAccessToken as ReturnType<typeof vi.fn>;
const mockIsValidFormat = isValidTokenFormat as ReturnType<typeof vi.fn>;

describe("Guest Access API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = mockUser;
    });
    await guestAccessRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/threat-models/:threatModelId/guest-access", () => {
    it("grants guest access successfully", async () => {
      mockGrant.mockResolvedValue({
        success: true,
        accessId: "access-1",
        accessToken: "tok_abc123",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/threat-models/tm-1/guest-access",
        payload: { email: "guest@example.com", role: "VIEWER" },
      });

      expect(response.statusCode).toBe(201);
      expect(mockGrant).toHaveBeenCalled();
    });

    it("returns 403 when not allowed", async () => {
      mockGrant.mockResolvedValue({
        success: false,
        error: "Only owners can grant access",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/threat-models/tm-1/guest-access",
        payload: { email: "guest@example.com", role: "VIEWER" },
      });

      expect(response.statusCode).toBe(403);
    });

    it("returns 400 for invalid email", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/threat-models/tm-1/guest-access",
        payload: { email: "not-an-email", role: "VIEWER" },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/threat-models/:threatModelId/guest-access", () => {
    it("lists guest access records", async () => {
      mockList.mockResolvedValue({
        success: true,
        accessRecords: [
          { id: "access-1", email: "guest@example.com", role: "VIEWER" },
        ],
        canManageAccess: true,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models/tm-1/guest-access",
      });

      expect(response.statusCode).toBe(200);
      expect(mockList).toHaveBeenCalledWith("tm-1", "user-1");
    });

    it("returns 403 when not an active member", async () => {
      mockList.mockResolvedValue({
        success: false,
        error: "You are not an active member of this organization",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models/tm-1/guest-access",
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/threat-models/:threatModelId/guest-access/:accessId", () => {
    it("revokes guest access", async () => {
      mockRevoke.mockResolvedValue({ success: true });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/threat-models/tm-1/guest-access/access-1",
      });

      expect(response.statusCode).toBe(200);
      expect(mockRevoke).toHaveBeenCalledWith(
        "access-1",
        "user-1",
        "test@example.com",
      );
    });

    it("returns 403 when lacking permissions", async () => {
      mockRevoke.mockResolvedValue({
        success: false,
        error: "Only owners and admins can revoke access",
      });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/threat-models/tm-1/guest-access/access-1",
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/guest-access/validate", () => {
    it("validates a valid token", async () => {
      mockIsValidFormat.mockReturnValue(true);
      mockValidate.mockResolvedValue({
        valid: true,
        threatModelId: "tm-1",
        role: "VIEWER",
        canExport: false,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/guest-access/validate",
        payload: { token: "ftm_valid_token_abc123" },
      });

      expect(response.statusCode).toBe(200);
      expect(mockValidate).toHaveBeenCalledWith(
        "ftm_valid_token_abc123",
        expect.any(String),
      );
    });

    it("returns 400 for invalid token format", async () => {
      mockIsValidFormat.mockReturnValue(false);

      const response = await app.inject({
        method: "POST",
        url: "/api/guest-access/validate",
        payload: { token: "bad" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 401 for expired token", async () => {
      mockIsValidFormat.mockReturnValue(true);
      mockValidate.mockResolvedValue({
        valid: false,
        error: "Token has expired",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/guest-access/validate",
        payload: { token: "ftm_expired_token" },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(false);
    });
  });
});
