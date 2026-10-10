/**
 * useBoundaryGrouping Tests
 *
 * Tests for the boundary grouping utility functions and store integration.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore, type CanvasNode } from "@/stores/canvas";
import {
  isPointInBoundary,
  isNodeInBoundary,
  getChildrenBounds,
  type BoundaryBounds,
  BOUNDARY_PADDING,
  MIN_BOUNDARY_WIDTH,
  MIN_BOUNDARY_HEIGHT,
} from "./useBoundaryGrouping";

describe("useBoundaryGrouping utilities", () => {
  describe("isPointInBoundary", () => {
    const boundary: BoundaryBounds = {
      id: "boundary-1",
      x: 100,
      y: 100,
      width: 400,
      height: 300,
    };

    it("should return true for point inside boundary", () => {
      expect(isPointInBoundary({ x: 200, y: 200 }, boundary)).toBe(true);
    });

    it("should return true for point on boundary edge", () => {
      expect(isPointInBoundary({ x: 100, y: 100 }, boundary)).toBe(true);
      expect(isPointInBoundary({ x: 500, y: 400 }, boundary)).toBe(true);
    });

    it("should return false for point outside boundary", () => {
      expect(isPointInBoundary({ x: 50, y: 50 }, boundary)).toBe(false);
      expect(isPointInBoundary({ x: 600, y: 200 }, boundary)).toBe(false);
    });

    it("should return false for point just outside boundary", () => {
      expect(isPointInBoundary({ x: 99, y: 200 }, boundary)).toBe(false);
      expect(isPointInBoundary({ x: 501, y: 200 }, boundary)).toBe(false);
    });
  });

  describe("isNodeInBoundary", () => {
    const boundary: BoundaryBounds = {
      id: "boundary-1",
      x: 100,
      y: 100,
      width: 400,
      height: 300,
    };

    it("should return true when node center is inside boundary", () => {
      const node = { position: { x: 200, y: 200 } };
      expect(isNodeInBoundary(node, boundary)).toBe(true);
    });

    it("should return false when node center is outside boundary", () => {
      const node = { position: { x: 0, y: 0 } };
      expect(isNodeInBoundary(node, boundary)).toBe(false);
    });

    it("should use node dimensions to calculate center", () => {
      // Node at x=25, center = 25 + 75 = 100 (on boundary edge)
      const node = { position: { x: 25, y: 170 } };
      expect(isNodeInBoundary(node, boundary)).toBe(true);
    });

    it("should respect custom node dimensions", () => {
      const node = { position: { x: 50, y: 150 } };
      // With width=200, center = 50 + 100 = 150 (inside)
      expect(isNodeInBoundary(node, boundary, 200, 100)).toBe(true);
    });
  });

  describe("getChildrenBounds", () => {
    it("should return null for empty children array", () => {
      expect(getChildrenBounds([])).toBeNull();
    });

    it("should calculate bounds for single child", () => {
      const children = [{ position: { x: 100, y: 100 } }];
      const bounds = getChildrenBounds(children);
      expect(bounds).toEqual({
        minX: 100,
        minY: 100,
        maxX: 260, // 100 + 160 (default width)
        maxY: 160, // 100 + 60 (default height)
      });
    });

    it("should calculate bounds for multiple children", () => {
      const children = [
        { position: { x: 100, y: 100 } },
        { position: { x: 300, y: 200 } },
        { position: { x: 50, y: 150 } },
      ];
      const bounds = getChildrenBounds(children);
      expect(bounds).toEqual({
        minX: 50,
        minY: 100,
        maxX: 460, // 300 + 160
        maxY: 260, // 200 + 60
      });
    });

    it("should use custom node dimensions", () => {
      const children = [{ position: { x: 100, y: 100 } }];
      const bounds = getChildrenBounds(children, 200, 100);
      expect(bounds).toEqual({
        minX: 100,
        minY: 100,
        maxX: 300, // 100 + 200
        maxY: 200, // 100 + 100
      });
    });
  });

  describe("constants", () => {
    it("should export BOUNDARY_PADDING", () => {
      expect(BOUNDARY_PADDING).toBe(10);
    });

    it("should export MIN_BOUNDARY_WIDTH", () => {
      expect(MIN_BOUNDARY_WIDTH).toBe(200);
    });

    it("should export MIN_BOUNDARY_HEIGHT", () => {
      expect(MIN_BOUNDARY_HEIGHT).toBe(150);
    });
  });
});

describe("useBoundaryGrouping with store", () => {
  beforeEach(() => {
    // Reset canvas store
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      selectedEdgeIds: [],
    });
  });

  describe("boundary children", () => {
    it("should identify children by parentId", () => {
      const boundaryNode: CanvasNode = {
        id: "boundary-1",
        type: "boundary",
        position: { x: 100, y: 100 },
        data: { label: "Trust Zone", trustLevel: "INTERNAL" },
      };

      const childNode1: CanvasNode = {
        id: "child-1",
        type: "component",
        position: { x: 150, y: 150 },
        data: { label: "Service A", type: "service", trustLevel: "INTERNAL" },
        parentId: "boundary-1",
      };

      const childNode2: CanvasNode = {
        id: "child-2",
        type: "component",
        position: { x: 250, y: 150 },
        data: { label: "Service B", type: "service", trustLevel: "INTERNAL" },
        parentId: "boundary-1",
      };

      const orphanNode: CanvasNode = {
        id: "orphan-1",
        type: "component",
        position: { x: 600, y: 100 },
        data: {
          label: "External",
          type: "external_entity",
          trustLevel: "PUBLIC",
        },
      };

      useCanvasStore.setState({
        nodes: [boundaryNode, childNode1, childNode2, orphanNode],
      });

      const state = useCanvasStore.getState();
      const children = state.nodes.filter((n) => n.parentId === "boundary-1");

      expect(children).toHaveLength(2);
      expect(children.map((c) => c.id)).toContain("child-1");
      expect(children.map((c) => c.id)).toContain("child-2");
    });
  });

  describe("updateNodeParent", () => {
    it("should update node parent and convert position to relative", () => {
      const boundaryNode: CanvasNode = {
        id: "boundary-1",
        type: "boundary",
        position: { x: 100, y: 100 },
        data: { label: "Trust Zone", trustLevel: "INTERNAL" },
      };

      const componentNode: CanvasNode = {
        id: "component-1",
        type: "component",
        position: { x: 200, y: 200 },
        data: { label: "Service", type: "service", trustLevel: "INTERNAL" },
      };

      useCanvasStore.setState({
        nodes: [boundaryNode, componentNode],
      });

      // Assign to boundary
      useCanvasStore.getState().updateNodeParent("component-1", "boundary-1");

      const updatedNode = useCanvasStore
        .getState()
        .nodes.find((n) => n.id === "component-1");

      expect(updatedNode?.parentId).toBe("boundary-1");
      // Position should be relative to parent
      expect(updatedNode?.position).toEqual({ x: 100, y: 100 }); // 200-100, 200-100
    });

    it("should remove parent and convert to absolute position", () => {
      const boundaryNode: CanvasNode = {
        id: "boundary-1",
        type: "boundary",
        position: { x: 100, y: 100 },
        data: { label: "Trust Zone", trustLevel: "INTERNAL" },
      };

      const componentNode: CanvasNode = {
        id: "component-1",
        type: "component",
        position: { x: 50, y: 50 }, // Relative to parent
        data: { label: "Service", type: "service", trustLevel: "INTERNAL" },
        parentId: "boundary-1",
      };

      useCanvasStore.setState({
        nodes: [boundaryNode, componentNode],
      });

      // Remove from boundary
      useCanvasStore.getState().updateNodeParent("component-1", null);

      const updatedNode = useCanvasStore
        .getState()
        .nodes.find((n) => n.id === "component-1");

      expect(updatedNode?.parentId).toBeUndefined();
      // Position should be absolute now
      expect(updatedNode?.position).toEqual({ x: 150, y: 150 }); // 100+50, 100+50
    });
  });

  describe("updateBoundarySize", () => {
    it("should update boundary width and height", () => {
      const boundaryNode: CanvasNode = {
        id: "boundary-1",
        type: "boundary",
        position: { x: 100, y: 100 },
        data: { label: "Trust Zone", trustLevel: "CONFIDENTIAL" },
        style: { width: 400, height: 300 },
      };

      useCanvasStore.setState({
        nodes: [boundaryNode],
      });

      useCanvasStore.getState().updateBoundarySize("boundary-1", 600, 400);

      const updatedBoundary = useCanvasStore
        .getState()
        .nodes.find((n) => n.id === "boundary-1");

      expect(updatedBoundary?.style?.width).toBe(600);
      expect(updatedBoundary?.style?.height).toBe(400);
    });
  });
});
