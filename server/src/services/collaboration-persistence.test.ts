/**
 * A collaboration session must never start from an empty or stale Yjs doc
 * that the next save would write back over the real model:
 * - canvasState that is not valid JSON fails init instead of serving empty;
 * - a transient error loading collaborationState fails init instead of
 *   falling back to the older canvasState;
 * - only a collaborationState that is genuinely undecodable is cleared and
 *   rebuilt from canvasState.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";

const prisma = {
  threatModel: { findUnique: vi.fn(), update: vi.fn() },
};
vi.mock("../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));
vi.mock("./redis-collaboration.js", () => ({
  isRedisEnabled: () => false,
  saveDocumentState: vi.fn(),
  loadDocumentState: vi.fn(),
  subscribeToUpdates: vi.fn(),
  unsubscribeFromUpdates: vi.fn(),
  broadcastUpdate: vi.fn(),
  registerSession: vi.fn(),
  unregisterSession: vi.fn(),
}));

const { initCollaborationFromCanvas } = await import(
  "./collaboration-persistence.js"
);
const { getOrCreateDoc } = await import("./collaboration.js");

let n = 0;
const freshId = () => `model-${++n}`;
const nodes = (id: string) =>
  getOrCreateDoc(id).doc.getArray("nodes").toArray();

describe("initCollaborationFromCanvas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("seeds the doc from a valid canvasState", async () => {
    const id = freshId();
    prisma.threatModel.findUnique.mockResolvedValue({
      canvasState: JSON.stringify({ nodes: [{ id: "a" }], edges: [] }),
      collaborationState: null,
    });
    await initCollaborationFromCanvas(id);
    expect(nodes(id)).toEqual([{ id: "a" }]);
  });

  it("refuses to start from a canvasState that is not valid JSON", async () => {
    const id = freshId();
    prisma.threatModel.findUnique.mockResolvedValue({
      canvasState: "{not json",
      collaborationState: null,
    });
    await expect(initCollaborationFromCanvas(id)).rejects.toThrow(/canvas/i);
  });

  it("refuses to fall back to canvasState when loading collaborationState fails transiently", async () => {
    const id = freshId();
    const doc = new Y.Doc();
    doc.getArray("nodes").push([{ id: "newer" }]);
    const state = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
    prisma.threatModel.findUnique
      .mockResolvedValueOnce({
        canvasState: JSON.stringify({ nodes: [{ id: "older" }], edges: [] }),
        collaborationState: state,
      })
      .mockRejectedValueOnce(new Error("connection reset"));

    await expect(initCollaborationFromCanvas(id)).rejects.toThrow(
      /connection reset/,
    );
    expect(nodes(id)).not.toEqual([{ id: "older" }]);
  });

  it("clears an undecodable collaborationState and rebuilds from canvasState", async () => {
    const id = freshId();
    const row = {
      canvasState: JSON.stringify({ nodes: [{ id: "c" }], edges: [] }),
      collaborationState: Buffer.from("garbage-not-yjs").toString("base64"),
    };
    prisma.threatModel.findUnique.mockResolvedValue(row);
    await initCollaborationFromCanvas(id);
    expect(prisma.threatModel.update).toHaveBeenCalledWith({
      where: { id },
      data: { collaborationState: null },
    });
    expect(nodes(id)).toEqual([{ id: "c" }]);
  });
});
