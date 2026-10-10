/**
 * First-run setup: a production install needs the setup token, and two
 * concurrent setup requests cannot both create a super admin.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";

const tx = {
  systemSettings: { upsert: vi.fn(), updateMany: vi.fn() },
  user: { create: vi.fn() },
  organization: { create: vi.fn() },
  membership: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};
const mockPrisma = {
  systemSettings: { findUnique: vi.fn() },
  user: { findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn(() => 0) },
  organization: { findUnique: vi.fn() },
  $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
};
vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../../services/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../../../services/password-validation.js", () => ({
  validatePassword: vi.fn(() => Promise.resolve({ valid: true, errors: [] })),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  getSetupRateLimit: vi.fn(() => ({ config: {} })),
}));

const body = {
  admin: {
    name: "Admin",
    email: "admin@example.com",
    password: "pw",
  },
  organization: { name: "Acme", slug: "acme" },
  ai: { enabled: false, provider: "none" },
};

async function buildApp() {
  const { setupRoutes } = await import("../index.js");
  const app = Fastify();
  await app.register(setupRoutes);
  await app.ready();
  return app;
}

describe("POST /api/setup/initialize", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockPrisma.systemSettings.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    tx.user.create.mockResolvedValue({ id: "u1", email: "admin@example.com" });
    tx.organization.create.mockResolvedValue({ id: "o1" });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("refuses when another request already claimed setup", async () => {
    tx.systemSettings.updateMany.mockResolvedValue({ count: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/setup/initialize",
      payload: body,
    });
    expect(res.statusCode).toBe(400);
    expect(tx.user.create).not.toHaveBeenCalled();
    await app.close();
  });

  it("creates the super admin when the claim succeeds", async () => {
    tx.systemSettings.updateMany.mockResolvedValue({ count: 1 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/setup/initialize",
      payload: body,
    });
    expect(res.statusCode).toBe(201);
    expect(tx.user.create).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("needs the setup token in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SETUP_TOKEN", "the-setup-token");
    tx.systemSettings.updateMany.mockResolvedValue({ count: 1 });
    const app = await buildApp();

    const without = await app.inject({
      method: "POST",
      url: "/api/setup/initialize",
      payload: body,
    });
    expect(without.statusCode).toBe(401);

    const status = await app.inject({
      method: "GET",
      url: "/api/setup/status",
    });
    expect(status.json().data.setupTokenRequired).toBe(true);

    const withToken = await app.inject({
      method: "POST",
      url: "/api/setup/initialize",
      payload: body,
      headers: { "x-setup-token": "the-setup-token" },
    });
    expect(withToken.statusCode).toBe(201);
    await app.close();
  });
});
