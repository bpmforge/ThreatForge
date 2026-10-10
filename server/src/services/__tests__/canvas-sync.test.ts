/**
 * canvas-sync orphan sweep must exempt the "compound" sentinel.
 *
 * doSyncCanvasToDatabase deletes AI_SUGGESTED/PENDING/manuallyEdited:false
 * threats whose componentNodeId is absent from the incoming canvas node ids.
 * Compound threats (threats spanning multiple components) store the literal
 * sentinel "compound" in componentNodeId — since no canvas node is ever id
 * "compound", every save swept them away. A genuinely orphaned threat
 * (a real, stale node id) must still be removed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncCanvasToDatabase, clearSyncCache } from "../canvas-sync.js";

interface ThreatRow {
  id: string;
  componentNodeId: string | null;
}

let threatRows: ThreatRow[] = [];
let deletedIds: string[][] = [];

function makePrisma() {
  const prisma: Record<string, unknown> = {
    component: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(async ({ data }: { data: { nodeId: string } }) => ({
        id: `comp-${data.nodeId}`,
      })),
      createManyAndReturn: vi.fn(
        async ({ data }: { data: Array<{ nodeId: string }> }) =>
          data.map((d) => ({ id: `comp-${d.nodeId}`, nodeId: d.nodeId })),
      ),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    componentInterface: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({ id: "iface-1" }),
      createManyAndReturn: vi.fn().mockResolvedValue([]),
    },
    connection: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    boundary: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({ id: "bnd-1" }),
      createManyAndReturn: vi.fn().mockResolvedValue([]),
    },
    threat: {
      findMany: vi.fn(async () => threatRows),
      deleteMany: vi.fn(
        async ({ where }: { where: { id: { in: string[] } } }) => {
          deletedIds.push(where.id.in);
          return { count: where.id.in.length };
        },
      ),
    },
  };
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<void>) =>
    fn(prisma),
  );
  return prisma;
}

let mockPrisma = makePrisma();

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

vi.mock("../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("canvas-sync orphan sweep — compound sentinel exemption", () => {
  beforeEach(() => {
    threatRows = [];
    deletedIds = [];
    mockPrisma = makePrisma();
    clearSyncCache();
  });

  const canvasState = {
    nodes: [
      {
        id: "node-1",
        type: "component" as const,
        position: { x: 0, y: 0 },
        data: { type: "SERVICE", label: "Web Service" },
      },
    ],
    edges: [],
  };

  it("keeps a compound threat (componentNodeId === 'compound') on save", async () => {
    threatRows = [{ id: "threat-compound", componentNodeId: "compound" }];

    await syncCanvasToDatabase("model-1", canvasState);

    const allDeleted = deletedIds.flat();
    expect(allDeleted).not.toContain("threat-compound");
  });

  it("keeps a supply-chain threat (componentNodeId === 'supply-chain') on save", async () => {
    threatRows = [{ id: "threat-sc", componentNodeId: "supply-chain" }];

    await syncCanvasToDatabase("model-1", canvasState);

    expect(deletedIds.flat()).not.toContain("threat-sc");
  });

  it("still removes a genuinely orphaned threat", async () => {
    threatRows = [
      { id: "threat-orphan", componentNodeId: "node-that-no-longer-exists" },
    ];

    await syncCanvasToDatabase("model-1", canvasState);

    const allDeleted = deletedIds.flat();
    expect(allDeleted).toContain("threat-orphan");
  });
});

describe("canvas-sync — every save syncs (no process-local skip)", () => {
  beforeEach(() => {
    threatRows = [];
    mockPrisma = makePrisma();
    clearSyncCache();
  });

  const canvas = () => ({
    nodes: [
      {
        id: "node-1",
        type: "component" as const,
        position: { x: 0, y: 0 },
        data: { type: "SERVICE", label: "Web Service" },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });

  // A process-local "unchanged" cache would skip a save that another server
  // instance had overwritten in between; the diff makes re-syncing cheap.
  it("re-runs the sync for a repeated identical canvas", async () => {
    await syncCanvasToDatabase("model-1", canvas());
    await syncCanvasToDatabase("model-1", canvas());

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("a failed sync does not block the next one", async () => {
    (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("db down"),
    );
    await expect(syncCanvasToDatabase("model-1", canvas())).rejects.toThrow();
    await syncCanvasToDatabase("model-1", canvas());

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
