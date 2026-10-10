/**
 * canvas-sync against a real (SQLite) database, through a counting Prisma
 * spy. Guards the auto-save path (POST /save-canvas → syncCanvasToDatabase):
 *
 * - an unchanged canvas must not write anything (reads only);
 * - a save that keeps a node must keep that node's Component row id, so DFD
 *   entities linked to it (linkedComponentId, onDelete: SetNull) survive;
 * - a one-node move on an N-node canvas must cost a handful of Prisma calls,
 *   not O(N) creates + O(N) hash updates.
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
import type { PrismaClient } from "@prisma/client";
import { syncCanvasToDatabase, clearSyncCache } from "../canvas-sync.js";

/** Every Prisma client call made by the code under test, as "model.op". */
let calls: string[] = [];
let countedPrisma: unknown;

/* eslint-disable @typescript-eslint/no-explicit-any -- generic Prisma proxy */
function counting<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === "$transaction") {
        return (arg: unknown, opts?: unknown) => {
          calls.push("$transaction");
          if (typeof arg === "function") {
            return (target as any).$transaction(
              (tx: object) => (arg as (t: unknown) => unknown)(counting(tx)),
              opts,
            );
          }
          return (target as any).$transaction(arg, opts);
        };
      }
      if (
        typeof prop === "string" &&
        !prop.startsWith("$") &&
        value !== null &&
        typeof value === "object"
      ) {
        return new Proxy(value as object, {
          get(delegate, op) {
            const fn = Reflect.get(delegate, op);
            if (typeof fn !== "function") return fn;
            return (...args: unknown[]) => {
              calls.push(`${prop}.${String(op)}`);
              return (fn as (...a: unknown[]) => unknown).apply(delegate, args);
            };
          },
        });
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(async () => countedPrisma),
}));

const N = 20;

/** N components (half inside one boundary), a chain of edges, interfaces. */
function buildCanvas(moveNode?: string) {
  const nodes: Array<Record<string, unknown>> = [
    {
      id: "zone-1",
      type: "boundary",
      position: { x: 0, y: 0 },
      style: { width: 800, height: 600 },
      data: { label: "DMZ", trustLevel: "DMZ" },
    },
  ];
  for (let i = 0; i < N; i++) {
    const id = `node-${i}`;
    nodes.push({
      id,
      type: "component",
      position: { x: id === moveNode ? 999 : i * 10, y: i * 5 },
      ...(i % 2 === 0 ? { parentId: "zone-1" } : {}),
      data: {
        label: `Service ${i}`,
        type: i % 3 === 0 ? "DATABASE" : "MICROSERVICE",
        trustLevel: "INTERNAL",
        interfaces: [
          {
            id: `if-${i}`,
            name: `api-${i}`,
            direction: "ingress",
            position: "left",
            protocol: "HTTPS",
          },
        ],
      },
    });
  }
  const edges = [];
  for (let i = 0; i < N - 1; i++) {
    edges.push({
      id: `edge-${i}`,
      source: `node-${i}`,
      target: `node-${i + 1}`,
      data: {
        protocol: "HTTPS",
        authentication: "JWT",
        encrypted: true,
        targetInterfaceId: `if-${i + 1}`,
      },
    });
  }
  // Cast: the service's CanvasState type is internal to the module.
  return { nodes, edges } as unknown as Parameters<
    typeof syncCanvasToDatabase
  >[1];
}

describe("canvas-sync on the save path (real SQLite)", () => {
  let prisma: PrismaClient;
  let projectId: string;
  let userId: string;

  beforeAll(async () => {
    const { setupTestDatabase, testData } = await import("../../test/setup.js");
    prisma = await setupTestDatabase();
    countedPrisma = counting(prisma);
    const user = await testData.createUser();
    const org = await testData.createOrganization();
    await testData.createMembership(user.id, org.id);
    const project = await testData.createProject(org.id, user.id);
    projectId = project.id;
    userId = user.id;
  });

  afterAll(async () => {
    const { teardownTestDatabase } = await import("../../test/setup.js");
    await teardownTestDatabase();
  });

  let modelId: string;
  beforeEach(async () => {
    clearSyncCache();
    calls = [];
    const model = await prisma.threatModel.create({
      data: { name: "sync", projectId, createdById: userId },
    });
    modelId = model.id;
  });

  it("writes nothing for an unchanged canvas", async () => {
    await syncCanvasToDatabase(modelId, buildCanvas());
    calls = [];

    await syncCanvasToDatabase(modelId, buildCanvas());

    const writes = calls.filter((c) =>
      /\.(create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)$/.test(
        c,
      ),
    );
    expect(writes).toEqual([]);
  });

  it("keeps a DFD entity's linkedComponentId across a save that keeps the node", async () => {
    await syncCanvasToDatabase(modelId, buildCanvas());
    const before = await prisma.component.findUniqueOrThrow({
      where: {
        threatModelId_nodeId: { threatModelId: modelId, nodeId: "node-3" },
      },
    });
    const dfd = await prisma.dataFlowDiagram.create({
      data: { name: "L0", threatModelId: modelId },
    });
    const proc = await prisma.dFDProcess.create({
      data: {
        nodeId: "p-1",
        number: "1",
        name: "Proc",
        positionX: 0,
        positionY: 0,
        dfdId: dfd.id,
        linkedComponentId: before.id,
      },
    });

    // Auto-save after the user drags node-3.
    await syncCanvasToDatabase(modelId, buildCanvas("node-3"));

    const after = await prisma.component.findUniqueOrThrow({
      where: {
        threatModelId_nodeId: { threatModelId: modelId, nodeId: "node-3" },
      },
    });
    const reread = await prisma.dFDProcess.findUniqueOrThrow({
      where: { id: proc.id },
    });
    expect(reread.linkedComponentId).toBe(before.id);
    expect(after.id).toBe(before.id);
    expect(after.positionX).toBe(999);
  });

  it("a one-node move on an N-node canvas costs O(1) Prisma calls, not O(N)", async () => {
    await syncCanvasToDatabase(modelId, buildCanvas());
    const initialCalls = calls.length;
    calls = [];

    await syncCanvasToDatabase(modelId, buildCanvas("node-7"));
    const moveCalls = calls.length;

    // main (delete-all + recreate row by row) measured 87 calls for both
    // the initial save and the one-node move at N=20.
    expect(initialCalls).toBeLessThanOrEqual(12);
    expect(moveCalls).toBeLessThanOrEqual(8);

    // Table contents still mirror the canvas.
    const [components, connections, interfaces, boundaries] = await Promise.all(
      [
        prisma.component.count({ where: { threatModelId: modelId } }),
        prisma.connection.count({ where: { threatModelId: modelId } }),
        prisma.componentInterface.count({
          where: { component: { threatModelId: modelId } },
        }),
        prisma.boundary.count({ where: { threatModelId: modelId } }),
      ],
    );
    expect({ components, connections, interfaces, boundaries }).toEqual({
      components: N,
      connections: N - 1,
      interfaces: N,
      boundaries: 1,
    });
  });

  it("preserves analyzedAt for an unchanged component inside an unchanged boundary", async () => {
    await syncCanvasToDatabase(modelId, buildCanvas());
    const analyzedAt = new Date("2026-01-01T00:00:00Z");
    await prisma.component.updateMany({
      where: { threatModelId: modelId },
      data: { analyzedAt },
    });

    // node-7 (not in the zone) moves; node-2 sits in zone-1 and is untouched.
    await syncCanvasToDatabase(modelId, buildCanvas("node-7"));

    const inZone = await prisma.component.findUniqueOrThrow({
      where: {
        threatModelId_nodeId: { threatModelId: modelId, nodeId: "node-2" },
      },
    });
    expect(inZone.boundaryId).not.toBeNull();
    expect(inZone.analyzedAt?.toISOString()).toBe(analyzedAt.toISOString());
  });

  it("resets analyzedAt when a component's threat surface changes, and removes deleted nodes", async () => {
    await syncCanvasToDatabase(modelId, buildCanvas());
    await prisma.component.updateMany({
      where: { threatModelId: modelId },
      data: { analyzedAt: new Date("2026-01-01T00:00:00Z") },
    });

    const canvas = buildCanvas() as unknown as {
      nodes: Array<{ id: string; data: { label: string } }>;
      edges: Array<{ id: string; source: string; target: string }>;
    };
    const node5 = canvas.nodes.find((n) => n.id === "node-5");
    if (!node5) throw new Error("fixture lost node-5");
    node5.data.label = "Renamed";
    canvas.nodes = canvas.nodes.filter((n) => n.id !== "node-10");
    canvas.edges = canvas.edges.filter(
      (e) => e.source !== "node-10" && e.target !== "node-10",
    );
    await syncCanvasToDatabase(
      modelId,
      canvas as unknown as Parameters<typeof syncCanvasToDatabase>[1],
    );

    const renamed = await prisma.component.findUniqueOrThrow({
      where: {
        threatModelId_nodeId: { threatModelId: modelId, nodeId: "node-5" },
      },
    });
    expect(renamed.name).toBe("Renamed");
    expect(renamed.analyzedAt).toBeNull();
    const gone = await prisma.component.findUnique({
      where: {
        threatModelId_nodeId: { threatModelId: modelId, nodeId: "node-10" },
      },
    });
    expect(gone).toBeNull();
    expect(
      await prisma.connection.count({ where: { threatModelId: modelId } }),
    ).toBe(N - 3);
  });
});
