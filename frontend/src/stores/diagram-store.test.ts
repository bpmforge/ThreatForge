import { describe, it, expect, beforeEach } from "vitest";
import { useDiagramStore } from "./diagram-store";

describe("diagram-store", () => {
  beforeEach(() => {
    // Reset store state before each test
    useDiagramStore.getState().reset();
  });

  describe("initial state", () => {
    it("starts with architecture tab active", () => {
      const state = useDiagramStore.getState();
      expect(state.activeTabId).toBe("architecture");
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe("architecture");
      expect(state.tabs[0].type).toBe("architecture");
      expect(state.tabs[0].closeable).toBe(false);
    });
  });

  describe("setActiveTab", () => {
    it("sets the active tab", () => {
      const { addSequenceTab, setActiveTab } = useDiagramStore.getState();
      addSequenceTab("seq1", "Sequence 1", "sd-1");

      setActiveTab("architecture");

      const state = useDiagramStore.getState();
      expect(state.activeTabId).toBe("architecture");
    });
  });

  describe("addSequenceTab", () => {
    it("adds a new sequence tab", () => {
      const { addSequenceTab } = useDiagramStore.getState();
      addSequenceTab("seq1", "Login Flow", "sd-1");

      const state = useDiagramStore.getState();
      expect(state.tabs).toHaveLength(2);
      expect(state.tabs[1].id).toBe("seq1");
      expect(state.tabs[1].type).toBe("sequence");
      expect(state.tabs[1].label).toBe("Login Flow");
      expect(state.tabs[1].sequenceDiagramId).toBe("sd-1");
      expect(state.tabs[1].closeable).toBe(true);
    });

    it("switches to the new tab after adding", () => {
      const { addSequenceTab } = useDiagramStore.getState();
      addSequenceTab("seq1", "Sequence 1", "sd-1");

      const state = useDiagramStore.getState();
      expect(state.activeTabId).toBe("seq1");
    });

    it("can add multiple sequence tabs", () => {
      const { addSequenceTab } = useDiagramStore.getState();
      addSequenceTab("seq1", "Sequence 1", "sd-1");
      addSequenceTab("seq2", "Sequence 2", "sd-2");
      addSequenceTab("seq3", "Sequence 3", "sd-3");

      const state = useDiagramStore.getState();
      expect(state.tabs).toHaveLength(4);
      expect(state.activeTabId).toBe("seq3"); // Last added is active
    });
  });

  describe("removeTab", () => {
    it("removes a sequence tab", () => {
      const { addSequenceTab, removeTab } = useDiagramStore.getState();
      addSequenceTab("seq1", "Sequence 1", "sd-1");

      removeTab("seq1");

      const state = useDiagramStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe("architecture");
    });

    it("cannot remove the architecture tab", () => {
      const { removeTab } = useDiagramStore.getState();
      removeTab("architecture");

      const state = useDiagramStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe("architecture");
    });

    it("switches to previous tab when removing active tab", () => {
      const { addSequenceTab, removeTab, setActiveTab } =
        useDiagramStore.getState();
      addSequenceTab("seq1", "Sequence 1", "sd-1");
      addSequenceTab("seq2", "Sequence 2", "sd-2");
      setActiveTab("seq2");

      removeTab("seq2");

      const state = useDiagramStore.getState();
      expect(state.activeTabId).toBe("seq1");
    });

    it("switches to architecture tab when removing last sequence tab", () => {
      const { addSequenceTab, removeTab } = useDiagramStore.getState();
      addSequenceTab("seq1", "Sequence 1", "sd-1");

      removeTab("seq1");

      const state = useDiagramStore.getState();
      expect(state.activeTabId).toBe("architecture");
    });

    it("does nothing when removing non-existent tab", () => {
      const { removeTab } = useDiagramStore.getState();
      removeTab("nonexistent");

      const state = useDiagramStore.getState();
      expect(state.tabs).toHaveLength(1);
    });
  });

  describe("renameTab", () => {
    it("renames a tab", () => {
      const { addSequenceTab, renameTab } = useDiagramStore.getState();
      addSequenceTab("seq1", "Old Name", "sd-1");

      renameTab("seq1", "New Name");

      const state = useDiagramStore.getState();
      expect(state.tabs[1].label).toBe("New Name");
    });

    it("can rename the architecture tab", () => {
      const { renameTab } = useDiagramStore.getState();
      renameTab("architecture", "Main Diagram");

      const state = useDiagramStore.getState();
      expect(state.tabs[0].label).toBe("Main Diagram");
    });
  });

  describe("initializeTabs", () => {
    it("initializes tabs from sequence diagrams", () => {
      const { initializeTabs } = useDiagramStore.getState();
      initializeTabs([
        { id: "sd-1", name: "Login Flow" },
        { id: "sd-2", name: "Checkout Flow" },
      ]);

      const state = useDiagramStore.getState();
      expect(state.tabs).toHaveLength(3);
      expect(state.tabs[0].id).toBe("architecture");
      expect(state.tabs[1].id).toBe("sequence-sd-1");
      expect(state.tabs[1].label).toBe("Login Flow");
      expect(state.tabs[2].id).toBe("sequence-sd-2");
      expect(state.tabs[2].label).toBe("Checkout Flow");
    });

    it("resets to architecture tab on initialize", () => {
      const { addSequenceTab, initializeTabs } = useDiagramStore.getState();
      addSequenceTab("old-seq", "Old Sequence", "old-id");

      initializeTabs([{ id: "new-id", name: "New Sequence" }]);

      const state = useDiagramStore.getState();
      expect(state.activeTabId).toBe("architecture");
      expect(state.tabs).toHaveLength(2);
    });

    it("handles empty sequence diagrams", () => {
      const { initializeTabs } = useDiagramStore.getState();
      initializeTabs([]);

      const state = useDiagramStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe("architecture");
    });
  });

  describe("reset", () => {
    it("resets to initial state", () => {
      const { addSequenceTab, reset } = useDiagramStore.getState();
      addSequenceTab("seq1", "Sequence 1", "sd-1");
      addSequenceTab("seq2", "Sequence 2", "sd-2");

      reset();

      const state = useDiagramStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.activeTabId).toBe("architecture");
    });
  });
});
