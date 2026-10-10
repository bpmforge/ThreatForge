/**
 * create-from-github created a threat model in whatever projectId the body
 * named, without checking the caller belongs to that project's org.
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
  membership: { findFirst: vi.fn() },
  project: { findFirst: vi.fn(), create: vi.fn() },
  threatModel: { create: vi.fn() },
};

vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock(
  "../../../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { projectGrants, resetGrants } = await import(
  "../../../../test/helpers/access-control-mock.js"
);
const { createFromGithubRoutes } = await import("../create-from-github.js");

const fetchMock = vi.fn();

describe("create-from-github project authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    vi.stubGlobal("fetch", fetchMock);
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(createFromGithubRoutes);
    await app.ready();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
    fetchMock.mockRejectedValue(new Error("network disabled in test"));
    mockPrisma.threatModel.create.mockResolvedValue({ id: "new-model" });
    mockPrisma.membership.findFirst.mockResolvedValue(null);
  });

  const create = (projectId?: string) =>
    app.inject({
      method: "POST",
      url: "/api/threat-models/create-from-github",
      payload: { repoUrl: "https://github.com/acme/app", projectId },
    });

  it("rejects a project in an org the caller does not belong to", async () => {
    const res = await create("victim-project");
    expect(res.statusCode).toBe(403);
    expect(mockPrisma.threatModel.create).not.toHaveBeenCalled();
  });

  it("rejects a project where the caller is only a VIEWER", async () => {
    projectGrants.set("p1", { role: "VIEWER", organizationId: "o1" });
    const res = await create("p1");
    expect(res.statusCode).toBe(403);
    expect(mockPrisma.threatModel.create).not.toHaveBeenCalled();
  });

  it("creates the model for an EDITOR of the project", async () => {
    projectGrants.set("p1", { role: "EDITOR", organizationId: "o1" });
    const res = await create("p1");
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.threatModel.create.mock.calls[0][0].data.projectId).toBe(
      "p1",
    );
  });

  it("only falls back to an org where the caller is an ACTIVE editor+", async () => {
    await create();
    expect(mockPrisma.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "caller",
          status: "ACTIVE",
          role: { in: ["OWNER", "ADMIN", "EDITOR"] },
        },
      }),
    );
    expect(mockPrisma.threatModel.create).not.toHaveBeenCalled();
  });
});
