/**
 * User-story data-flow link/unlink trusted ids from the request: linking
 * accepted any data flow id (and echoed it back — another tenant's flow
 * names and data types), unlinking accepted any story id. Both are now bound
 * to the project in the URL. Story writes also accepted any org member;
 * they now need edit on the project.
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
import { createFakePrisma } from "../../test/helpers/fake-prisma.js";

const prisma = createFakePrisma(
  {
    // Shaped for the old inline check too, so these cases fail on the old
    // code for the binding bug rather than for a missing fixture.
    project: [
      { id: "p1", organization: { memberships: [{ role: "VIEWER" }] } },
    ],
    userStory: [
      { id: "s1", projectId: "p1" },
      { id: "s-victim", projectId: "p-victim" },
    ],
    threatModel: [
      { id: "m1", projectId: "p1" },
      { id: "m-victim", projectId: "p-victim" },
    ],
    dataFlowDiagram: [
      { id: "dfd1", threatModelId: "m1" },
      { id: "dfd-victim", threatModelId: "m-victim" },
    ],
    dFDDataFlow: [
      { id: "df1", dfdId: "dfd1", name: "mine" },
      { id: "df-victim", dfdId: "dfd-victim", name: "SECRET" },
    ],
    userStoryDataFlow: [
      { id: "l-victim", userStoryId: "s-victim", dataFlowId: "df-victim" },
    ],
  },
  {
    dFDDataFlow: { dfd: ["dataFlowDiagram", "dfdId"] },
    dataFlowDiagram: { threatModel: ["threatModel", "threatModelId"] },
  },
);

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(prisma)),
}));
vi.mock(
  "../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { projectGrants, resetGrants } = await import(
  "../../test/helpers/access-control-mock.js"
);
const { userStoryRoutes } = await import("../user-stories.js");

describe("user story data-flow links", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(userStoryRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
    projectGrants.set("p1", { role: "EDITOR", organizationId: "o1" });
  });

  it("link refuses another tenant's data flow", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects/p1/user-stories/s1/data-flows",
      payload: { dataFlowId: "df-victim" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain("SECRET");
    expect(prisma.userStoryDataFlow.create).not.toHaveBeenCalled();
  });

  it("link accepts a data flow of a model in the same project", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects/p1/user-stories/s1/data-flows",
      payload: { dataFlowId: "df1" },
    });
    expect(res.statusCode).toBe(201);
  });

  it("unlink refuses a story of another project", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/projects/p1/user-stories/s-victim/data-flows/df-victim",
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.userStoryDataFlow.delete).not.toHaveBeenCalled();
  });

  it("a viewer cannot link or create", async () => {
    projectGrants.set("p1", { role: "VIEWER", organizationId: "o1" });
    const link = await app.inject({
      method: "POST",
      url: "/api/projects/p1/user-stories/s1/data-flows",
      payload: { dataFlowId: "df1" },
    });
    expect(link.statusCode).toBe(403);
    const create = await app.inject({
      method: "POST",
      url: "/api/projects/p1/user-stories",
      payload: { title: "t", asA: "a", iWant: "w", soThat: "s" },
    });
    expect(create.statusCode).toBe(403);
    expect(prisma.userStory.create).not.toHaveBeenCalled();
  });
});
