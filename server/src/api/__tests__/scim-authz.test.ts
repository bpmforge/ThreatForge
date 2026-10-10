/**
 * SCIM tenant isolation: one org's SCIM token manages memberships in that org
 * and the accounts it provisioned, never another person's global account.
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

const mockPrisma = {
  scimToken: {
    findFirst: vi.fn(),
    update: vi.fn(() => Promise.resolve({})),
  },
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  membership: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

const { scimRoutes } = await import("../scim.js");

const auth = { authorization: "Bearer scim-token-of-attacker-org" };
const victim = {
  id: "victim-1",
  name: "Victim",
  email: "victim@corp.test",
  status: "ACTIVE",
  createdAt: new Date(),
};

describe("SCIM tenant isolation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(scimRoutes, { prefix: "/api" });
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.scimToken.findFirst.mockResolvedValue({
      id: "tok-1",
      organizationId: "org-attacker",
    });
  });

  it("will not attach an existing account to the token's org", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(victim);
    mockPrisma.membership.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: "POST",
      url: "/api/scim/v2/Users",
      headers: auth,
      payload: { schemas: [], userName: victim.email },
    });

    expect(res.statusCode).toBe(409);
    expect(mockPrisma.membership.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("will not rewrite the email of an account another org also uses", async () => {
    mockPrisma.membership.findFirst.mockResolvedValue({
      id: "m1",
      user: victim,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      scimProvisioned: false,
      isSuperAdmin: false,
    });
    mockPrisma.membership.count.mockResolvedValue(1);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/scim/v2/Users/${victim.id}`,
      headers: auth,
      payload: {
        schemas: [],
        Operations: [
          { op: "replace", path: "userName", value: "attacker@evil.test" },
          { op: "replace", path: "active", value: false },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    // The membership in the token's own org may still be suspended.
    expect(mockPrisma.membership.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { status: "SUSPENDED" },
    });
  });

  it("still updates an account this org provisioned and solely owns", async () => {
    mockPrisma.membership.findFirst.mockResolvedValue({
      id: "m1",
      user: victim,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      scimProvisioned: true,
      isSuperAdmin: false,
    });
    mockPrisma.membership.count.mockResolvedValue(0);

    await app.inject({
      method: "PATCH",
      url: `/api/scim/v2/Users/${victim.id}`,
      headers: auth,
      payload: {
        schemas: [],
        Operations: [
          { op: "replace", path: "userName", value: "new@corp.test" },
        ],
      },
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: victim.id },
      data: { email: "new@corp.test" },
    });
  });

  it("cannot suspend or delete an organization owner", async () => {
    mockPrisma.membership.findFirst.mockResolvedValue({
      id: "m-owner",
      role: "OWNER",
      user: victim,
    });

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/scim/v2/Users/${victim.id}`,
      headers: auth,
      payload: {
        schemas: [],
        Operations: [{ op: "replace", path: "active", value: false }],
      },
    });
    const del = await app.inject({
      method: "DELETE",
      url: `/api/scim/v2/Users/${victim.id}`,
      headers: auth,
    });

    expect(patch.statusCode).toBe(403);
    expect(del.statusCode).toBe(403);
    expect(mockPrisma.membership.update).not.toHaveBeenCalled();
  });
});
