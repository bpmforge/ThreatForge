import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore, type CanvasNode, type CanvasEdge } from "./canvas";

/** Helper to create test nodes with minimal required data */
function createTestNode(
  overrides: Partial<CanvasNode> & { id: string },
): CanvasNode {
  return {
    type: "component",
    position: { x: 0, y: 0 },
    data: { label: "Test", type: "PROCESS", trustLevel: "INTERNAL" },
    ...overrides,
  } as CanvasNode;
}

/** Helper to create test edges */
function createTestEdge(
  overrides: Partial<CanvasEdge> & {
    id: string;
    source: string;
    target: string;
  },
): CanvasEdge {
  return {
    type: "security",
    data: { encrypted: false, authenticated: false },
    ...overrides,
  } as CanvasEdge;
}

describe("canvas-store", () => {
  beforeEach(() => {
    // Reset store state before each test
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      selectedEdgeIds: [],
      isDirty: false,
    });
  });

  describe("initial state", () => {
    it("starts with empty canvas", () => {
      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(0);
      expect(state.edges).toHaveLength(0);
      expect(state.selectedNodeIds).toHaveLength(0);
      expect(state.selectedEdgeIds).toHaveLength(0);
      expect(state.isDirty).toBe(false);
    });
  });

  describe("addComponent", () => {
    it("adds a component node to the canvas", () => {
      const { addComponent } = useCanvasStore.getState();
      const id = addComponent("API", { x: 100, y: 200 });

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe(id);
      expect(state.nodes[0].type).toBe("component");
      expect(state.nodes[0].position).toEqual({ x: 100, y: 200 });
      expect(state.nodes[0].data.label).toBe("API");
      expect(state.isDirty).toBe(true);
    });

    it("uses custom label when provided", () => {
      const { addComponent } = useCanvasStore.getState();
      addComponent("DATABASE", { x: 0, y: 0 }, "User DB");

      const state = useCanvasStore.getState();
      expect(state.nodes[0].data.label).toBe("User DB");
    });

    it("uses default label for each component type", () => {
      const { addComponent } = useCanvasStore.getState();

      addComponent("ACTOR", { x: 0, y: 0 });
      addComponent("PROCESS", { x: 0, y: 0 });
      addComponent("DATA_STORE", { x: 0, y: 0 });

      const state = useCanvasStore.getState();
      expect(state.nodes[0].data.label).toBe("User");
      expect(state.nodes[1].data.label).toBe("Process");
      expect(state.nodes[2].data.label).toBe("Database");
    });
  });

  describe("addBoundary", () => {
    it("adds a boundary node to the canvas", () => {
      const { addBoundary } = useCanvasStore.getState();
      const id = addBoundary({ x: 50, y: 50 });

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe(id);
      expect(state.nodes[0].type).toBe("boundary");
      expect(state.nodes[0].position).toEqual({ x: 50, y: 50 });
      expect(state.nodes[0].style).toEqual({ width: 400, height: 300 });
      expect(state.isDirty).toBe(true);
    });

    it("uses custom label when provided", () => {
      const { addBoundary } = useCanvasStore.getState();
      addBoundary({ x: 0, y: 0 }, "DMZ");

      const state = useCanvasStore.getState();
      expect(state.nodes[0].data.label).toBe("DMZ");
    });
  });

  describe("updateNodeData", () => {
    it("updates node data partially", () => {
      const { addComponent, updateNodeData } = useCanvasStore.getState();
      const id = addComponent("API", { x: 0, y: 0 });

      updateNodeData(id, {
        label: "Updated API",
        description: "New description",
      });

      const state = useCanvasStore.getState();
      expect(state.nodes[0].data.label).toBe("Updated API");
      expect(state.nodes[0].data.description).toBe("New description");
      expect(state.nodes[0].data.type).toBe("API"); // unchanged
    });
  });

  describe("updateEdgeData", () => {
    it("updates edge data partially", () => {
      // First create nodes and a connection
      useCanvasStore.setState({
        nodes: [
          createTestNode({
            id: "node1",
            data: { label: "A", type: "API", trustLevel: "INTERNAL" },
          }),
          createTestNode({
            id: "node2",
            position: { x: 100, y: 0 },
            data: { label: "B", type: "DATABASE", trustLevel: "INTERNAL" },
          }),
        ],
        edges: [
          createTestEdge({ id: "edge1", source: "node1", target: "node2" }),
        ],
        selectedNodeIds: [],
        selectedEdgeIds: [],
        isDirty: false,
      });

      const { updateEdgeData } = useCanvasStore.getState();
      updateEdgeData("edge1", { encrypted: true, protocol: "HTTPS" });

      const state = useCanvasStore.getState();
      expect(state.edges[0].data?.encrypted).toBe(true);
      expect(state.edges[0].data?.protocol).toBe("HTTPS");
      expect(state.edges[0].data?.authenticated).toBe(false); // unchanged
    });
  });

  describe("deleteSelected", () => {
    it("deletes selected nodes", () => {
      const { addComponent, setSelection, deleteSelected } =
        useCanvasStore.getState();
      const id1 = addComponent("API", { x: 0, y: 0 });
      const id2 = addComponent("DATABASE", { x: 100, y: 0 });

      setSelection([id1], []);
      deleteSelected();

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe(id2);
    });

    it("deletes edges connected to deleted nodes", () => {
      useCanvasStore.setState({
        nodes: [
          createTestNode({
            id: "node1",
            data: { label: "A", type: "API", trustLevel: "INTERNAL" },
          }),
          createTestNode({
            id: "node2",
            position: { x: 100, y: 0 },
            data: { label: "B", type: "DATABASE", trustLevel: "INTERNAL" },
          }),
        ],
        edges: [
          createTestEdge({ id: "edge1", source: "node1", target: "node2" }),
        ],
        selectedNodeIds: ["node1"],
        selectedEdgeIds: [],
        isDirty: false,
      });

      const { deleteSelected } = useCanvasStore.getState();
      deleteSelected();

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.edges).toHaveLength(0); // Edge deleted because node1 was deleted
    });

    it("clears selection after delete", () => {
      const { addComponent, setSelection, deleteSelected } =
        useCanvasStore.getState();
      const id = addComponent("API", { x: 0, y: 0 });

      setSelection([id], []);
      deleteSelected();

      const state = useCanvasStore.getState();
      expect(state.selectedNodeIds).toHaveLength(0);
      expect(state.selectedEdgeIds).toHaveLength(0);
    });
  });

  describe("setSelection", () => {
    it("sets node and edge selection", () => {
      const { setSelection } = useCanvasStore.getState();
      setSelection(["node1", "node2"], ["edge1"]);

      const state = useCanvasStore.getState();
      expect(state.selectedNodeIds).toEqual(["node1", "node2"]);
      expect(state.selectedEdgeIds).toEqual(["edge1"]);
    });
  });

  describe("loadCanvas", () => {
    it("loads nodes and edges", () => {
      const { loadCanvas } = useCanvasStore.getState();
      const nodes = [
        createTestNode({
          id: "n1",
          data: { label: "A", type: "API", trustLevel: "INTERNAL" },
        }),
      ];
      const edges = [createTestEdge({ id: "e1", source: "n1", target: "n2" })];

      loadCanvas(nodes, edges);

      const state = useCanvasStore.getState();
      expect(state.nodes).toEqual(nodes);
      expect(state.edges).toEqual(edges);
      expect(state.isDirty).toBe(false);
    });
  });

  describe("clearCanvas", () => {
    it("removes all nodes and edges", () => {
      const { addComponent, clearCanvas } = useCanvasStore.getState();
      addComponent("API", { x: 0, y: 0 });
      addComponent("DATABASE", { x: 100, y: 0 });

      clearCanvas();

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(0);
      expect(state.edges).toHaveLength(0);
      expect(state.selectedNodeIds).toHaveLength(0);
      expect(state.selectedEdgeIds).toHaveLength(0);
    });
  });

  describe("markSaved", () => {
    it("sets isDirty to false", () => {
      const { addComponent, markSaved } = useCanvasStore.getState();
      addComponent("API", { x: 0, y: 0 });

      expect(useCanvasStore.getState().isDirty).toBe(true);

      markSaved();

      expect(useCanvasStore.getState().isDirty).toBe(false);
    });
  });

  describe("z-index operations", () => {
    beforeEach(() => {
      useCanvasStore.setState({
        nodes: [
          createTestNode({
            id: "n1",
            data: { label: "A", type: "API", trustLevel: "INTERNAL" },
            zIndex: 0,
          }),
          createTestNode({
            id: "n2",
            position: { x: 100, y: 0 },
            data: { label: "B", type: "API", trustLevel: "INTERNAL" },
            zIndex: 1,
          }),
          createTestNode({
            id: "n3",
            position: { x: 200, y: 0 },
            data: { label: "C", type: "API", trustLevel: "INTERNAL" },
            zIndex: 2,
          }),
        ],
        edges: [],
        selectedNodeIds: [],
        selectedEdgeIds: [],
        isDirty: false,
      });
    });

    it("bringToFront sets highest z-index", () => {
      const { bringToFront } = useCanvasStore.getState();
      bringToFront("n1");

      const state = useCanvasStore.getState();
      const node1 = state.nodes.find((n) => n.id === "n1");
      expect(node1?.zIndex).toBe(3); // max was 2, now 3
    });

    it("sendToBack sets lowest z-index", () => {
      const { sendToBack } = useCanvasStore.getState();
      sendToBack("n3");

      const state = useCanvasStore.getState();
      const node3 = state.nodes.find((n) => n.id === "n3");
      expect(node3?.zIndex).toBe(-1); // min was 0, now -1
    });

    it("bringForward increments z-index by 1", () => {
      const { bringForward } = useCanvasStore.getState();
      bringForward("n1");

      const state = useCanvasStore.getState();
      const node1 = state.nodes.find((n) => n.id === "n1");
      expect(node1?.zIndex).toBe(1);
    });

    it("sendBackward decrements z-index by 1", () => {
      const { sendBackward } = useCanvasStore.getState();
      sendBackward("n3");

      const state = useCanvasStore.getState();
      const node3 = state.nodes.find((n) => n.id === "n3");
      expect(node3?.zIndex).toBe(1);
    });
  });

  describe("duplicateSelected", () => {
    it("duplicates selected nodes with offset", () => {
      useCanvasStore.setState({
        nodes: [
          createTestNode({
            id: "n1",
            position: { x: 100, y: 100 },
            data: { label: "A", type: "API", trustLevel: "INTERNAL" },
          }),
        ],
        edges: [],
        selectedNodeIds: ["n1"],
        selectedEdgeIds: [],
        isDirty: false,
      });

      const { duplicateSelected } = useCanvasStore.getState();
      duplicateSelected();

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(2);

      const newNode = state.nodes.find((n) => n.id !== "n1");
      expect(newNode?.position).toEqual({ x: 150, y: 150 }); // offset by 50
      expect(newNode?.data.label).toBe("A");
    });

    it("duplicates edges between selected nodes", () => {
      useCanvasStore.setState({
        nodes: [
          createTestNode({
            id: "n1",
            data: { label: "A", type: "API", trustLevel: "INTERNAL" },
          }),
          createTestNode({
            id: "n2",
            position: { x: 100, y: 0 },
            data: { label: "B", type: "DATABASE", trustLevel: "INTERNAL" },
          }),
        ],
        edges: [
          createTestEdge({
            id: "e1",
            source: "n1",
            target: "n2",
            data: { encrypted: true, authenticated: false },
          }),
        ],
        selectedNodeIds: ["n1", "n2"],
        selectedEdgeIds: [],
        isDirty: false,
      });

      const { duplicateSelected } = useCanvasStore.getState();
      duplicateSelected();

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(4);
      expect(state.edges).toHaveLength(2);

      const newEdge = state.edges.find((e) => e.id !== "e1");
      expect(newEdge?.data?.encrypted).toBe(true);
    });

    it("selects the new nodes after duplication", () => {
      useCanvasStore.setState({
        nodes: [
          createTestNode({
            id: "n1",
            data: { label: "A", type: "API", trustLevel: "INTERNAL" },
          }),
        ],
        edges: [],
        selectedNodeIds: ["n1"],
        selectedEdgeIds: [],
        isDirty: false,
      });

      const { duplicateSelected } = useCanvasStore.getState();
      duplicateSelected();

      const state = useCanvasStore.getState();
      expect(state.selectedNodeIds).toHaveLength(1);
      expect(state.selectedNodeIds[0]).not.toBe("n1");
    });

    it("does nothing when no nodes selected", () => {
      useCanvasStore.setState({
        nodes: [
          createTestNode({
            id: "n1",
            data: { label: "A", type: "API", trustLevel: "INTERNAL" },
          }),
        ],
        edges: [],
        selectedNodeIds: [],
        selectedEdgeIds: [],
        isDirty: false,
      });

      const { duplicateSelected } = useCanvasStore.getState();
      duplicateSelected();

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(1);
    });
  });

  describe("updateNodeParent", () => {
    it("sets parent and converts to relative position", () => {
      useCanvasStore.setState({
        nodes: [
          {
            id: "boundary",
            type: "boundary",
            position: { x: 100, y: 100 },
            data: { label: "B", trustLevel: "INTERNAL" },
          } as CanvasNode,
          createTestNode({
            id: "child",
            position: { x: 150, y: 150 },
            data: { label: "C", type: "API", trustLevel: "INTERNAL" },
          }),
        ],
        edges: [],
        selectedNodeIds: [],
        selectedEdgeIds: [],
        isDirty: false,
      });

      const { updateNodeParent } = useCanvasStore.getState();
      updateNodeParent("child", "boundary");

      const state = useCanvasStore.getState();
      const child = state.nodes.find((n) => n.id === "child");
      expect(child?.parentId).toBe("boundary");
      expect(child?.position).toEqual({ x: 50, y: 50 }); // relative to parent
      // Children must be free to leave the boundary (UC-19 drag-out)
      expect(child?.extent).toBeUndefined();
    });

    it("removes parent and converts to absolute position", () => {
      useCanvasStore.setState({
        nodes: [
          {
            id: "boundary",
            type: "boundary",
            position: { x: 100, y: 100 },
            data: { label: "B", trustLevel: "INTERNAL" },
          } as CanvasNode,
          {
            id: "child",
            type: "component",
            position: { x: 50, y: 50 },
            parentId: "boundary",
            extent: "parent",
            data: { label: "C", type: "API", trustLevel: "INTERNAL" },
          } as CanvasNode,
        ],
        edges: [],
        selectedNodeIds: [],
        selectedEdgeIds: [],
        isDirty: false,
      });

      const { updateNodeParent } = useCanvasStore.getState();
      updateNodeParent("child", null);

      const state = useCanvasStore.getState();
      const child = state.nodes.find((n) => n.id === "child");
      expect(child?.parentId).toBeUndefined();
      expect(child?.position).toEqual({ x: 150, y: 150 }); // absolute position
    });
  });

  describe("updateBoundarySize", () => {
    it("updates boundary dimensions", () => {
      useCanvasStore.setState({
        nodes: [
          {
            id: "boundary",
            type: "boundary",
            position: { x: 0, y: 0 },
            style: { width: 400, height: 300 },
            data: { label: "B", trustLevel: "INTERNAL" },
          } as CanvasNode,
        ],
        edges: [],
        selectedNodeIds: [],
        selectedEdgeIds: [],
        isDirty: false,
      });

      const { updateBoundarySize } = useCanvasStore.getState();
      updateBoundarySize("boundary", 600, 400);

      const state = useCanvasStore.getState();
      expect(state.nodes[0].style).toEqual({ width: 600, height: 400 });
    });
  });

  describe("getBoundaryChildren", () => {
    it("returns all children of a boundary", () => {
      useCanvasStore.setState({
        nodes: [
          {
            id: "boundary",
            type: "boundary",
            position: { x: 0, y: 0 },
            data: { label: "B", trustLevel: "INTERNAL" },
          } as CanvasNode,
          {
            id: "child1",
            type: "component",
            position: { x: 50, y: 50 },
            parentId: "boundary",
            data: { label: "C1", type: "API", trustLevel: "INTERNAL" },
          } as CanvasNode,
          {
            id: "child2",
            type: "component",
            position: { x: 100, y: 50 },
            parentId: "boundary",
            data: { label: "C2", type: "API", trustLevel: "INTERNAL" },
          } as CanvasNode,
          createTestNode({
            id: "other",
            position: { x: 500, y: 500 },
            data: { label: "O", type: "PROCESS", trustLevel: "INTERNAL" },
          }),
        ],
        edges: [],
        selectedNodeIds: [],
        selectedEdgeIds: [],
        isDirty: false,
      });

      const { getBoundaryChildren } = useCanvasStore.getState();
      const children = getBoundaryChildren("boundary");

      expect(children).toHaveLength(2);
      expect(children.map((c) => c.id).sort()).toEqual(["child1", "child2"]);
    });
  });

  describe("toggleSecurityOverlay", () => {
    beforeEach(() => {
      localStorage.clear();
      useCanvasStore.setState({ securityOverlay: true });
    });

    it("flips securityOverlay from true to false", () => {
      useCanvasStore.getState().toggleSecurityOverlay();
      expect(useCanvasStore.getState().securityOverlay).toBe(false);
    });

    it("flips securityOverlay from false to true", () => {
      useCanvasStore.setState({ securityOverlay: false });
      useCanvasStore.getState().toggleSecurityOverlay();
      expect(useCanvasStore.getState().securityOverlay).toBe(true);
    });

    it("persists new value to localStorage", () => {
      useCanvasStore.getState().toggleSecurityOverlay(); // true → false
      expect(localStorage.getItem("ff:security-overlay")).toBe("false");
      useCanvasStore.getState().toggleSecurityOverlay(); // false → true
      expect(localStorage.getItem("ff:security-overlay")).toBe("true");
    });
  });
});
