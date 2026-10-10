import { describe, it, expect, beforeEach } from "vitest";
import {
  useHistoryStore,
  createSnapshot,
  type CanvasSnapshot,
} from "./history-store";

/** Helper to create test snapshots */
function makeSnapshot(
  nodes: { id: string }[] = [],
  edges: { id: string }[] = [],
): CanvasSnapshot {
  return {
    nodes: nodes as CanvasSnapshot["nodes"],
    edges: edges as CanvasSnapshot["edges"],
    timestamp: Date.now(),
  };
}

describe("history-store", () => {
  beforeEach(() => {
    // Reset store state before each test
    useHistoryStore.setState({
      past: [],
      future: [],
      maxSize: 50,
      isBatching: false,
      batchStart: null,
    });
  });

  describe("initial state", () => {
    it("starts with empty history", () => {
      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(0);
      expect(state.future).toHaveLength(0);
      expect(state.isBatching).toBe(false);
      expect(state.batchStart).toBeNull();
    });

    it("canUndo returns false when no history", () => {
      const { canUndo } = useHistoryStore.getState();
      expect(canUndo()).toBe(false);
    });

    it("canRedo returns false when no future", () => {
      const { canRedo } = useHistoryStore.getState();
      expect(canRedo()).toBe(false);
    });
  });

  describe("push", () => {
    it("adds snapshot to past", () => {
      const { push } = useHistoryStore.getState();
      const snapshot = makeSnapshot([{ id: "n1" }]);

      push(snapshot, "addNode");

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(1);
      expect(state.past[0].snapshot).toEqual(snapshot);
      expect(state.past[0].actionName).toBe("addNode");
    });

    it("clears future on new push", () => {
      useHistoryStore.setState({
        past: [],
        future: [{ snapshot: makeSnapshot(), actionName: "old" }],
        maxSize: 50,
        isBatching: false,
        batchStart: null,
      });

      const { push } = useHistoryStore.getState();
      push(makeSnapshot(), "new");

      const state = useHistoryStore.getState();
      expect(state.future).toHaveLength(0);
    });

    it("respects maxSize limit", () => {
      useHistoryStore.setState({
        past: [],
        future: [],
        maxSize: 3,
        isBatching: false,
        batchStart: null,
      });

      const { push } = useHistoryStore.getState();
      push(makeSnapshot([{ id: "1" }]), "action1");
      push(makeSnapshot([{ id: "2" }]), "action2");
      push(makeSnapshot([{ id: "3" }]), "action3");
      push(makeSnapshot([{ id: "4" }]), "action4");

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(3);
      expect(state.past[0].snapshot.nodes[0].id).toBe("2"); // First was trimmed
    });

    it("does not push during batching", () => {
      const { push, startBatch } = useHistoryStore.getState();
      startBatch(makeSnapshot());

      push(makeSnapshot(), "ignored");

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(0);
    });
  });

  describe("undo", () => {
    it("returns previous snapshot", () => {
      const snapshot1 = makeSnapshot([{ id: "n1" }]);
      const snapshot2 = makeSnapshot([{ id: "n1" }, { id: "n2" }]);

      useHistoryStore.setState({
        past: [{ snapshot: snapshot1, actionName: "addNode" }],
        future: [],
        maxSize: 50,
        isBatching: false,
        batchStart: null,
      });

      const { undo } = useHistoryStore.getState();
      const result = undo(snapshot2);

      expect(result).toEqual(snapshot1);
    });

    it("moves current to future", () => {
      const snapshot1 = makeSnapshot([{ id: "n1" }]);
      const currentSnapshot = makeSnapshot([{ id: "n1" }, { id: "n2" }]);

      useHistoryStore.setState({
        past: [{ snapshot: snapshot1, actionName: "addNode" }],
        future: [],
        maxSize: 50,
        isBatching: false,
        batchStart: null,
      });

      const { undo } = useHistoryStore.getState();
      undo(currentSnapshot);

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(0);
      expect(state.future).toHaveLength(1);
      expect(state.future[0].snapshot).toEqual(currentSnapshot);
    });

    it("returns null when no history", () => {
      const { undo } = useHistoryStore.getState();
      const result = undo(makeSnapshot());

      expect(result).toBeNull();
    });

    it("enables canUndo when history exists", () => {
      useHistoryStore.setState({
        past: [{ snapshot: makeSnapshot(), actionName: "action" }],
        future: [],
        maxSize: 50,
        isBatching: false,
        batchStart: null,
      });

      const { canUndo } = useHistoryStore.getState();
      expect(canUndo()).toBe(true);
    });
  });

  describe("redo", () => {
    it("returns next snapshot from future", () => {
      const futureSnapshot = makeSnapshot([{ id: "n1" }, { id: "n2" }]);
      const currentSnapshot = makeSnapshot([{ id: "n1" }]);

      useHistoryStore.setState({
        past: [],
        future: [{ snapshot: futureSnapshot, actionName: "addNode" }],
        maxSize: 50,
        isBatching: false,
        batchStart: null,
      });

      const { redo } = useHistoryStore.getState();
      const result = redo(currentSnapshot);

      expect(result).toEqual(futureSnapshot);
    });

    it("moves current to past", () => {
      const futureSnapshot = makeSnapshot([{ id: "n1" }, { id: "n2" }]);
      const currentSnapshot = makeSnapshot([{ id: "n1" }]);

      useHistoryStore.setState({
        past: [],
        future: [{ snapshot: futureSnapshot, actionName: "addNode" }],
        maxSize: 50,
        isBatching: false,
        batchStart: null,
      });

      const { redo } = useHistoryStore.getState();
      redo(currentSnapshot);

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(1);
      expect(state.past[0].snapshot).toEqual(currentSnapshot);
      expect(state.future).toHaveLength(0);
    });

    it("returns null when no future", () => {
      const { redo } = useHistoryStore.getState();
      const result = redo(makeSnapshot());

      expect(result).toBeNull();
    });

    it("enables canRedo when future exists", () => {
      useHistoryStore.setState({
        past: [],
        future: [{ snapshot: makeSnapshot(), actionName: "action" }],
        maxSize: 50,
        isBatching: false,
        batchStart: null,
      });

      const { canRedo } = useHistoryStore.getState();
      expect(canRedo()).toBe(true);
    });
  });

  describe("undo/redo cycle", () => {
    it("supports multiple undo/redo operations", () => {
      const { push, undo, redo } = useHistoryStore.getState();

      const snapshot1 = makeSnapshot([{ id: "n1" }]);
      const snapshot2 = makeSnapshot([{ id: "n1" }, { id: "n2" }]);
      const snapshot3 = makeSnapshot([
        { id: "n1" },
        { id: "n2" },
        { id: "n3" },
      ]);

      push(snapshot1, "add1");
      push(snapshot2, "add2");

      // Undo twice
      const undone1 = undo(snapshot3);
      expect(undone1).toEqual(snapshot2);

      const undone2 = undo(snapshot2);
      expect(undone2).toEqual(snapshot1);

      // Redo twice
      const redone1 = redo(snapshot1);
      expect(redone1).toEqual(snapshot2);

      const redone2 = redo(snapshot2);
      expect(redone2).toEqual(snapshot3);
    });
  });

  describe("batch operations", () => {
    it("startBatch sets batching state", () => {
      const { startBatch } = useHistoryStore.getState();
      const snapshot = makeSnapshot();

      startBatch(snapshot);

      const state = useHistoryStore.getState();
      expect(state.isBatching).toBe(true);
      expect(state.batchStart).toEqual(snapshot);
    });

    it("endBatch commits batch as single entry", () => {
      const { startBatch, endBatch } = useHistoryStore.getState();
      const startSnapshot = makeSnapshot([{ id: "n1" }]);
      const endSnapshot = makeSnapshot([{ id: "n1" }, { id: "n2" }]);

      startBatch(startSnapshot);
      endBatch(endSnapshot, "batchAction");

      const state = useHistoryStore.getState();
      expect(state.isBatching).toBe(false);
      expect(state.batchStart).toBeNull();
      expect(state.past).toHaveLength(1);
      expect(state.past[0].snapshot).toEqual(startSnapshot);
      expect(state.past[0].actionName).toBe("batchAction");
    });

    it("endBatch does not commit if no changes", () => {
      const { startBatch, endBatch } = useHistoryStore.getState();
      const snapshot = makeSnapshot([{ id: "n1" }]);

      startBatch(snapshot);
      endBatch(snapshot, "noChange");

      const state = useHistoryStore.getState();
      expect(state.isBatching).toBe(false);
      expect(state.past).toHaveLength(0);
    });

    it("cancelBatch clears batch state without committing", () => {
      const { startBatch, cancelBatch } = useHistoryStore.getState();
      const snapshot = makeSnapshot();

      startBatch(snapshot);
      cancelBatch();

      const state = useHistoryStore.getState();
      expect(state.isBatching).toBe(false);
      expect(state.batchStart).toBeNull();
      expect(state.past).toHaveLength(0);
    });
  });

  describe("clear", () => {
    it("clears all history", () => {
      useHistoryStore.setState({
        past: [{ snapshot: makeSnapshot(), actionName: "a" }],
        future: [{ snapshot: makeSnapshot(), actionName: "b" }],
        maxSize: 50,
        isBatching: true,
        batchStart: makeSnapshot(),
      });

      const { clear } = useHistoryStore.getState();
      clear();

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(0);
      expect(state.future).toHaveLength(0);
      expect(state.isBatching).toBe(false);
      expect(state.batchStart).toBeNull();
    });
  });

  describe("getHistoryInfo", () => {
    it("returns correct counts", () => {
      useHistoryStore.setState({
        past: [
          { snapshot: makeSnapshot(), actionName: "a" },
          { snapshot: makeSnapshot(), actionName: "b" },
        ],
        future: [{ snapshot: makeSnapshot(), actionName: "c" }],
        maxSize: 50,
        isBatching: false,
        batchStart: null,
      });

      const { getHistoryInfo } = useHistoryStore.getState();
      const info = getHistoryInfo();

      expect(info.undoCount).toBe(2);
      expect(info.redoCount).toBe(1);
    });
  });
});

describe("createSnapshot", () => {
  it("creates snapshot with deep cloned data", () => {
    const nodes = [
      { id: "n1", data: { label: "Test" } },
    ] as CanvasSnapshot["nodes"];
    const edges = [
      { id: "e1", source: "n1", target: "n2" },
    ] as CanvasSnapshot["edges"];

    const snapshot = createSnapshot(nodes, edges);

    // Modify original
    nodes[0].data.label = "Modified";

    // Snapshot should be unchanged
    expect(snapshot.nodes[0].data.label).toBe("Test");
    expect(snapshot.timestamp).toBeLessThanOrEqual(Date.now());
  });
});
