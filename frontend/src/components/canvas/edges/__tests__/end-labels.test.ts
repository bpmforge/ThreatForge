import { describe, it, expect, beforeEach } from "vitest";
import { endLabelSlot, END_LABEL_T } from "../EdgeEndLabel";
import { useCanvasStore, type CanvasNode } from "@/stores/canvas";

describe("end labels — which label a double-click on the line addresses", () => {
  it("near the ends → that end, otherwise the mid label", () => {
    expect(endLabelSlot(0)).toBe("start");
    expect(endLabelSlot(END_LABEL_T.start)).toBe("start");
    expect(endLabelSlot(0.5)).toBe("mid");
    expect(endLabelSlot(END_LABEL_T.end)).toBe("end");
    expect(endLabelSlot(1)).toBe("end");
  });
});

describe("selection is not an edit", () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [
        {
          id: "a",
          type: "component",
          position: { x: 0, y: 0 },
          data: { label: "A", type: "API", trustLevel: "INTERNAL" },
        } as CanvasNode,
      ],
      edges: [],
      isDirty: false,
    });
  });

  it("selecting a node does not mark the model dirty", () => {
    useCanvasStore
      .getState()
      .onNodesChange([{ type: "select", id: "a", selected: true }]);
    expect(useCanvasStore.getState().isDirty).toBe(false);
  });

  it("moving a node still does", () => {
    useCanvasStore
      .getState()
      .onNodesChange([{ type: "position", id: "a", position: { x: 5, y: 5 } }]);
    expect(useCanvasStore.getState().isDirty).toBe(true);
  });
});
