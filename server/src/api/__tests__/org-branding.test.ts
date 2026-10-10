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
import { brandingRoutes } from "../organizations/routes/branding.js";

const mockUser = { id: "user-1", email: "u@example.com", name: "U" };

const mockPrisma = {
  membership: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn(), update: vi.fn() },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../services/audit.js", () => ({
  logAudit: vi.fn(() => Promise.resolve()),
}));

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("Org branding API authz", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = mockUser;
    });
    await brandingRoutes(app, {});
    await app.ready();
  });
  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue({
      logoUrl: PNG,
      settings: "{}",
    });
    mockPrisma.organization.update.mockImplementation(
      async ({ data }: { data: { settings: string } }) => ({
        logoUrl: PNG,
        settings: data.settings,
      }),
    );
  });

  const put = (payload: unknown) =>
    app.inject({
      method: "PUT",
      url: "/api/organizations/org-1/branding",
      payload: payload as object,
    });

  it.each(["MEMBER", "VIEWER"])("PUT forbidden for %s", async (role) => {
    mockPrisma.membership.findUnique.mockResolvedValue({
      role,
      status: "ACTIVE",
    });
    const res = await put({ primaryColor: "#112233" });
    expect(res.statusCode).toBe(403);
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it("PUT forbidden for non-members", async () => {
    mockPrisma.membership.findUnique.mockResolvedValue(null);
    expect((await put({ primaryColor: "#112233" })).statusCode).toBe(403);
  });

  it.each(["OWNER", "ADMIN"])(
    "PUT allowed for %s and stores colours",
    async (role) => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        role,
        status: "ACTIVE",
      });
      const res = await put({
        primaryColor: "#112233",
        accentColor: "#AABBCC",
      });
      expect(res.statusCode).toBe(200);
      const saved = JSON.parse(
        mockPrisma.organization.update.mock.calls[0][0].data.settings,
      );
      expect(saved.branding).toEqual({
        primaryColor: "#112233",
        accentColor: "#AABBCC",
      });
    },
  );

  it("PUT rejects non-hex colours", async () => {
    mockPrisma.membership.findUnique.mockResolvedValue({
      role: "ADMIN",
      status: "ACTIVE",
    });
    expect((await put({ primaryColor: "red" })).statusCode).toBe(400);
    expect((await put({ primaryColor: "url(x)" })).statusCode).toBe(400);
  });

  it("GET allowed for any member, forbidden otherwise", async () => {
    mockPrisma.membership.findUnique.mockResolvedValue({
      role: "VIEWER",
      status: "ACTIVE",
    });
    const ok = await app.inject({
      method: "GET",
      url: "/api/organizations/org-1/branding",
    });
    expect(ok.statusCode).toBe(200);
    mockPrisma.membership.findUnique.mockResolvedValue(null);
    const no = await app.inject({
      method: "GET",
      url: "/api/organizations/org-1/branding",
    });
    expect(no.statusCode).toBe(403);
  });
});
