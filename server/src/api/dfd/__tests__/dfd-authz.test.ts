/**
 * DFD routes authorization: dfd ids must belong to the threat model in the
 * URL, entity ids to the dfd, and writes need edit permission on the model.
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
import { createFakePrisma } from "../../../test/helpers/fake-prisma.js";

const inDfd: [string, string] = ["dataFlowDiagram", "dfdId"];
const prisma = createFakePrisma(
  {
    dataFlowDiagram: [
      { id: "d-a", threatModelId: "m-a", canvasState: "{}" },
      { id: "d-b", threatModelId: "m-b", canvasState: "{}" },
      { id: "d-view", threatModelId: "m-view", canvasState: "{}" },
    ],
    dFDProcess: [
      { id: "pr-a", dfdId: "d-a" },
      { id: "pr-b", dfdId: "d-b" },
    ],
    dFDDataStore: [{ id: "ds-b", dfdId: "d-b" }],
    dFDExternalEntity: [{ id: "ee-b", dfdId: "d-b" }],
    dFDDataFlow: [{ id: "fl-b", dfdId: "d-b" }],
  },
  {
    dFDProcess: { dfd: inDfd },
    dFDDataStore: { dfd: inDfd },
    dFDExternalEntity: { dfd: inDfd },
    dFDDataFlow: { dfd: inDfd },
  },
);

const access = (modelId: string) =>
  modelId === "m-a"
    ? { hasAccess: true, permissions: ["view", "edit"], isGuest: false }
    : modelId === "m-view"
      ? { hasAccess: true, permissions: ["view"], isGuest: false }
      : { hasAccess: false, permissions: [], isGuest: false };

vi.mock("../../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));
vi.mock("../../../services/access-control/access-control-service.js", () => ({
  checkThreatModelAccess: vi.fn(async (_u: string, m: string) => access(m)),
  canPerformAction: vi.fn(async (_u: string, m: string, action: string) => {
    const a = access(m);
    if (!a.hasAccess) return { allowed: false, error: "not found" };
    return a.permissions.includes(action)
      ? { allowed: true, access: a }
      : { allowed: false, error: `no '${action}' permission`, access: a };
  }),
}));

const { dfdRoutes } = await import("../index.js");

const kinds = [
  {
    path: "processes",
    model: "dFDProcess",
    otherId: "pr-b",
    body: { nodeId: "n", number: "1", name: "p", positionX: 0, positionY: 0 },
  },
  {
    path: "data-stores",
    model: "dFDDataStore",
    otherId: "ds-b",
    body: { nodeId: "n", number: "1", name: "s", positionX: 0, positionY: 0 },
  },
  {
    path: "external-entities",
    model: "dFDExternalEntity",
    otherId: "ee-b",
    body: {
      nodeId: "n",
      name: "e",
      entityType: "USER",
      positionX: 0,
      positionY: 0,
    },
  },
  {
    path: "data-flows",
    model: "dFDDataFlow",
    otherId: "fl-b",
    body: { edgeId: "e", name: "f" },
  },
] as const;

describe("DFD routes authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "u1", email: "u1@x.test", name: "U1" };
    });
    await app.register(dfdRoutes);
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("rejects a parentDfdId from another model", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/threat-models/m-a/dfds",
      payload: { name: "child", parentDfdId: "d-b" },
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.dataFlowDiagram.create).not.toHaveBeenCalled();
  });

  it("rejects DFD writes from a view-only user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/threat-models/m-view/dfds",
      payload: { name: "x" },
    });
    expect(res.statusCode).toBe(403);
    expect(prisma.dataFlowDiagram.create).not.toHaveBeenCalled();
  });

  it("rejects entity writes from a view-only user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/threat-models/m-view/dfds/d-view/processes",
      payload: kinds[0].body,
    });
    expect(res.statusCode).toBe(403);
    expect(prisma.dFDProcess.create).not.toHaveBeenCalled();
  });

  for (const k of kinds) {
    describe(k.path, () => {
      it("does not create into another model's DFD", async () => {
        const res = await app.inject({
          method: "POST",
          url: `/api/threat-models/m-a/dfds/d-b/${k.path}`,
          payload: k.body,
        });
        expect(res.statusCode).toBe(404);
        expect(prisma[k.model].create).not.toHaveBeenCalled();
      });

      it("does not update an entity of another DFD", async () => {
        const res = await app.inject({
          method: "PATCH",
          url: `/api/threat-models/m-a/dfds/d-a/${k.path}/${k.otherId}`,
          payload: { name: "pwned" },
        });
        expect(res.statusCode).toBe(404);
        expect(prisma[k.model].update).not.toHaveBeenCalled();
      });

      it("does not delete an entity of another DFD", async () => {
        const res = await app.inject({
          method: "DELETE",
          url: `/api/threat-models/m-a/dfds/d-a/${k.path}/${k.otherId}`,
        });
        expect(res.statusCode).toBe(404);
        expect(prisma[k.model].delete).not.toHaveBeenCalled();
      });
    });
  }

  it("rejects a data flow wired to another DFD's process", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/threat-models/m-a/dfds/d-a/data-flows",
      payload: {
        edgeId: "e",
        name: "f",
        sourceProcessId: "pr-a",
        targetProcessId: "pr-b",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(prisma.dFDDataFlow.create).not.toHaveBeenCalled();
  });

  it("creates a data flow between the DFD's own nodes", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/threat-models/m-a/dfds/d-a/data-flows",
      payload: {
        edgeId: "e",
        name: "f",
        sourceProcessId: "pr-a",
        targetProcessId: "pr-a",
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it("updates an entity of the caller's DFD", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/threat-models/m-a/dfds/d-a/processes/pr-a",
      payload: { name: "ok" },
    });
    expect(res.statusCode).toBe(200);
  });
});
