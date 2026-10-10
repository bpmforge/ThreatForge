/**
 * PATCH /api/threat-models/:id with projectId only required edit on the
 * model and *any* membership row in the target project's org, so an EDITOR
 * (including a guest editor) could move a model out of its organization
 * into another org they belong to.
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
  project: { findFirst: vi.fn() },
  threatModel: { findUnique: vi.fn(), update: vi.fn() },
};

vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../../../services/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../../../../services/canvas-sync.js", () => ({
  syncCanvasToDatabase: vi.fn(),
}));
vi.mock(
  "../../../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { modelGrants, projectGrants, orgRoles, resetGrants } = await import(
  "../../../../test/helpers/access-control-mock.js"
);
const { crudRoutes } = await import("../crud.js");

const MODEL = "m1";
const HOME_PROJECT = "p-home";
const HOME_ORG = "org-home";
const OTHER_PROJECT = "p-other";
const OTHER_ORG = "org-other";

describe("PATCH threat model projectId (move) authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(crudRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
    // The legacy target-project lookup (any membership) always succeeds,
    // which is the hole under test.
    mockPrisma.project.findFirst.mockResolvedValue({ id: OTHER_PROJECT });
    mockPrisma.threatModel.findUnique.mockResolvedValue({
      name: "Model",
      projectId: HOME_PROJECT,
      status: "DRAFT",
      canvasState: null,
      project: { organizationId: HOME_ORG, name: "Home" },
    });
    mockPrisma.threatModel.update.mockImplementation(
      async ({ data }: { data: { projectId?: string } }) => ({
        id: MODEL,
        name: "Model",
        canvasState: null,
        projectId: data.projectId ?? HOME_PROJECT,
        project: { id: HOME_PROJECT, name: "Home", organizationId: HOME_ORG },
      }),
    );
    projectGrants.set(OTHER_PROJECT, {
      role: "EDITOR",
      organizationId: OTHER_ORG,
    });
    projectGrants.set(HOME_PROJECT, {
      role: "EDITOR",
      organizationId: HOME_ORG,
    });
  });

  const patch = (payload: Record<string, unknown>) =>
    app.inject({
      method: "PATCH",
      url: `/api/threat-models/${MODEL}`,
      payload,
    });

  it("rejects an EDITOR moving the model into another org", async () => {
    modelGrants.set(MODEL, { role: "EDITOR", organizationId: HOME_ORG });
    orgRoles.set(HOME_ORG, "EDITOR");
    orgRoles.set(OTHER_ORG, "OWNER");

    const res = await patch({ projectId: OTHER_PROJECT });

    expect(res.statusCode).toBe(403);
    expect(mockPrisma.threatModel.update).not.toHaveBeenCalled();
  });

  it("rejects a guest editor", async () => {
    modelGrants.set(MODEL, {
      role: "EDITOR",
      guest: true,
      organizationId: HOME_ORG,
    });
    orgRoles.set(OTHER_ORG, "OWNER");

    const res = await patch({ projectId: OTHER_PROJECT });

    expect(res.statusCode).toBe(403);
    expect(mockPrisma.threatModel.update).not.toHaveBeenCalled();
  });

  it("rejects an ADMIN of the home org who is only an EDITOR in the destination", async () => {
    modelGrants.set(MODEL, { role: "ADMIN", organizationId: HOME_ORG });
    orgRoles.set(HOME_ORG, "ADMIN");
    orgRoles.set(OTHER_ORG, "EDITOR");

    const res = await patch({ projectId: OTHER_PROJECT });

    expect(res.statusCode).toBe(403);
    expect(mockPrisma.threatModel.update).not.toHaveBeenCalled();
  });

  it("rejects a destination project the caller cannot access", async () => {
    modelGrants.set(MODEL, { role: "OWNER", organizationId: HOME_ORG });
    orgRoles.set(HOME_ORG, "OWNER");
    projectGrants.delete(OTHER_PROJECT);

    const res = await patch({ projectId: OTHER_PROJECT });

    expect(res.statusCode).toBe(403);
    expect(mockPrisma.threatModel.update).not.toHaveBeenCalled();
  });

  it("allows an ADMIN/OWNER of both orgs to move", async () => {
    modelGrants.set(MODEL, { role: "ADMIN", organizationId: HOME_ORG });
    orgRoles.set(HOME_ORG, "ADMIN");
    orgRoles.set(OTHER_ORG, "OWNER");

    const res = await patch({ projectId: OTHER_PROJECT });

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.threatModel.update.mock.calls[0][0].data.projectId).toBe(
      OTHER_PROJECT,
    );
  });

  it("lets an EDITOR move the model between projects in the same org", async () => {
    modelGrants.set(MODEL, { role: "EDITOR", organizationId: HOME_ORG });
    orgRoles.set(HOME_ORG, "EDITOR");
    projectGrants.set("home-project-2", {
      role: "EDITOR",
      organizationId: HOME_ORG,
    });

    const res = await patch({ projectId: "home-project-2" });

    expect(res.statusCode).toBe(200);
  });

  it("rejects a VIEWER moving the model within the org", async () => {
    modelGrants.set(MODEL, { role: "EDITOR", organizationId: HOME_ORG });
    orgRoles.set(HOME_ORG, "VIEWER");
    projectGrants.set("home-project-2", {
      role: "VIEWER",
      organizationId: HOME_ORG,
    });

    const res = await patch({ projectId: "home-project-2" });

    expect(res.statusCode).toBe(403);
    expect(mockPrisma.threatModel.update).not.toHaveBeenCalled();
  });

  it("does not treat an unchanged projectId as a move", async () => {
    modelGrants.set(MODEL, { role: "EDITOR", organizationId: HOME_ORG });
    orgRoles.set(HOME_ORG, "EDITOR");

    const res = await patch({ name: "Renamed", projectId: HOME_PROJECT });

    expect(res.statusCode).toBe(200);
  });

  it("still lets an EDITOR rename", async () => {
    modelGrants.set(MODEL, { role: "EDITOR", organizationId: HOME_ORG });

    const res = await patch({ name: "Renamed" });

    expect(res.statusCode).toBe(200);
  });
});
