/**
 * PropertiesPanel Component Tests
 *
 * Real tests for the PropertiesPanel component using React Testing Library.
 * Mocks Zustand canvas store.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PropertiesPanel } from "./PropertiesPanel";
import type { Node, Edge } from "@xyflow/react";
import type {
  ComponentNodeData,
  BoundaryNodeData,
  ConnectionData,
} from "@/types/canvas";

// Mock the canvas store
vi.mock("@/stores/canvas", () => ({
  useCanvasStore: vi.fn(),
}));

// Mock useAnalysisStatus so tests don't need a QueryClientProvider
vi.mock("@/features/ai/hooks/useAnalysisStatus", () => ({
  useAnalysisStatus: () => ({ data: null }),
}));

import { useCanvasStore } from "@/stores/canvas";

// Sample test data
const sampleComponentNode: Node<ComponentNodeData> = {
  id: "component-1",
  type: "component",
  position: { x: 0, y: 0 },
  data: {
    label: "Web Server",
    type: "WEB_APP",
    trustLevel: "INTERNAL",
    description: "Main web application server",
  },
};

const sampleBoundaryNode: Node<BoundaryNodeData> = {
  id: "boundary-1",
  type: "boundary",
  position: { x: 0, y: 0 },
  data: {
    label: "DMZ",
    trustLevel: "PUBLIC",
  },
};

const sampleDatabaseNode: Node<ComponentNodeData> = {
  id: "component-2",
  type: "component",
  position: { x: 200, y: 0 },
  data: {
    label: "Database",
    type: "DATABASE",
    trustLevel: "CONFIDENTIAL",
  },
};

const sampleEdge: Edge<ConnectionData> = {
  id: "edge-1",
  source: "component-1",
  target: "component-2",
  data: {
    label: "SQL Query",
    protocol: "TCP",
    authentication: "mTLS",
    encrypted: true,
    authenticated: true,
    dataClassifications: ["Credentials", "Internal"],
  },
};

// Mock store state creator
function createMockStore(overrides: {
  nodes?: Node[];
  edges?: Edge[];
  selectedNodeIds?: string[];
  selectedEdgeIds?: string[];
  updateNodeData?: ReturnType<typeof vi.fn>;
  updateEdgeData?: ReturnType<typeof vi.fn>;
}) {
  const updateNodeData = overrides.updateNodeData || vi.fn();
  const updateEdgeData = overrides.updateEdgeData || vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (selector: any) => {
    const state = {
      nodes: overrides.nodes || [],
      edges: overrides.edges || [],
      selectedNodeIds: overrides.selectedNodeIds || [],
      selectedEdgeIds: overrides.selectedEdgeIds || [],
      updateNodeData,
      updateEdgeData,
    };
    return selector(state);
  };
}

describe("PropertiesPanel Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Empty State", () => {
    it("should show empty state when nothing is selected", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode, sampleDatabaseNode],
          edges: [sampleEdge],
          selectedNodeIds: [],
          selectedEdgeIds: [],
        }),
      );

      render(<PropertiesPanel />);

      expect(
        screen.getByText(/select a component or connection/i),
      ).toBeInTheDocument();
      expect(screen.getByText("Properties")).toBeInTheDocument();
    });

    it("should show empty state when multiple nodes are selected", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode, sampleDatabaseNode],
          selectedNodeIds: ["component-1", "component-2"],
          selectedEdgeIds: [],
        }),
      );

      render(<PropertiesPanel />);

      expect(
        screen.getByText(/select a component or connection/i),
      ).toBeInTheDocument();
    });
  });

  describe("Component Node Selection", () => {
    it("should display component properties when a component is selected", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode],
          selectedNodeIds: ["component-1"],
          selectedEdgeIds: [],
        }),
      );

      render(<PropertiesPanel />);

      expect(screen.getByText("Properties")).toBeInTheDocument();
      expect(screen.getByText("Component")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Web Server")).toBeInTheDocument();
    });

    it("should display component type selector for components", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode],
          selectedNodeIds: ["component-1"],
          selectedEdgeIds: [],
        }),
      );

      render(<PropertiesPanel />);

      expect(screen.getByLabelText("Type")).toBeInTheDocument();
    });

    it("should display trust level selector", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode],
          selectedNodeIds: ["component-1"],
          selectedEdgeIds: [],
        }),
      );

      render(<PropertiesPanel />);

      expect(screen.getByLabelText("Trust Level")).toBeInTheDocument();
    });

    it("should display description input", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode],
          selectedNodeIds: ["component-1"],
          selectedEdgeIds: [],
        }),
      );

      render(<PropertiesPanel />);

      expect(screen.getByLabelText("Description")).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("Main web application server"),
      ).toBeInTheDocument();
    });

    it("should call updateNodeData when label is changed", () => {
      const updateNodeData = vi.fn();
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode],
          selectedNodeIds: ["component-1"],
          selectedEdgeIds: [],
          updateNodeData,
        }),
      );

      render(<PropertiesPanel />);

      const labelInput = screen.getByDisplayValue("Web Server");
      fireEvent.change(labelInput, { target: { value: "New Name" } });

      expect(updateNodeData).toHaveBeenCalledWith("component-1", {
        label: "New Name",
      });
    });

    it("should call updateNodeData when description is changed", () => {
      const updateNodeData = vi.fn();
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode],
          selectedNodeIds: ["component-1"],
          selectedEdgeIds: [],
          updateNodeData,
        }),
      );

      render(<PropertiesPanel />);

      const descInput = screen.getByDisplayValue("Main web application server");
      fireEvent.change(descInput, { target: { value: "Updated description" } });

      expect(updateNodeData).toHaveBeenCalledWith("component-1", {
        description: "Updated description",
      });
    });
  });

  describe("Boundary Node Selection", () => {
    it("should display boundary properties when a boundary is selected", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleBoundaryNode],
          selectedNodeIds: ["boundary-1"],
          selectedEdgeIds: [],
        }),
      );

      render(<PropertiesPanel />);

      expect(screen.getByText("Properties")).toBeInTheDocument();
      expect(screen.getByText("Trust Boundary")).toBeInTheDocument();
      expect(screen.getByDisplayValue("DMZ")).toBeInTheDocument();
    });

    it("should NOT display type selector for boundaries", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleBoundaryNode],
          selectedNodeIds: ["boundary-1"],
          selectedEdgeIds: [],
        }),
      );

      render(<PropertiesPanel />);

      // Type selector should not be present for boundaries
      expect(screen.queryByLabelText("Type")).not.toBeInTheDocument();
    });

    it("should display trust level for boundaries", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleBoundaryNode],
          selectedNodeIds: ["boundary-1"],
          selectedEdgeIds: [],
        }),
      );

      render(<PropertiesPanel />);

      expect(screen.getByLabelText("Trust Level")).toBeInTheDocument();
    });
  });

  describe("Edge Selection", () => {
    it("should display edge properties when an edge is selected", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode, sampleDatabaseNode],
          edges: [sampleEdge],
          selectedNodeIds: [],
          selectedEdgeIds: ["edge-1"],
        }),
      );

      render(<PropertiesPanel />);

      expect(screen.getByText("Properties")).toBeInTheDocument();
      expect(screen.getByText("Connection / Data Flow")).toBeInTheDocument();
    });

    it("should display source and target node labels", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode, sampleDatabaseNode],
          edges: [sampleEdge],
          selectedNodeIds: [],
          selectedEdgeIds: ["edge-1"],
        }),
      );

      render(<PropertiesPanel />);

      expect(screen.getByText("Web Server")).toBeInTheDocument();
      expect(screen.getByText("Database")).toBeInTheDocument();
    });

    it("should display edge label input", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode, sampleDatabaseNode],
          edges: [sampleEdge],
          selectedNodeIds: [],
          selectedEdgeIds: ["edge-1"],
        }),
      );

      render(<PropertiesPanel />);

      expect(screen.getByLabelText("Label")).toBeInTheDocument();
      expect(screen.getByDisplayValue("SQL Query")).toBeInTheDocument();
    });

    it("should display line style section", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode, sampleDatabaseNode],
          edges: [sampleEdge],
          selectedNodeIds: [],
          selectedEdgeIds: ["edge-1"],
        }),
      );

      render(<PropertiesPanel />);

      // Line Style section is open by default
      expect(screen.getByText("Line Style")).toBeInTheDocument();
      expect(screen.getByText("Shape")).toBeInTheDocument();
    });

    it("should display protocol section (collapsed)", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode, sampleDatabaseNode],
          edges: [sampleEdge],
          selectedNodeIds: [],
          selectedEdgeIds: ["edge-1"],
        }),
      );

      render(<PropertiesPanel />);

      // Protocol section header should be visible (collapsed by default)
      expect(screen.getByText("Protocol")).toBeInTheDocument();
    });

    it("should display security section (collapsed)", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode, sampleDatabaseNode],
          edges: [sampleEdge],
          selectedNodeIds: [],
          selectedEdgeIds: ["edge-1"],
        }),
      );

      render(<PropertiesPanel />);

      // Security section header should be visible (collapsed by default)
      // Note: There are two "Security" sections in the component - Protocol and Security
      const securityHeaders = screen.getAllByText("Security");
      expect(securityHeaders.length).toBeGreaterThan(0);
    });

    it("should call updateEdgeData when label is changed", () => {
      const updateEdgeData = vi.fn();
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode, sampleDatabaseNode],
          edges: [sampleEdge],
          selectedNodeIds: [],
          selectedEdgeIds: ["edge-1"],
          updateEdgeData,
        }),
      );

      render(<PropertiesPanel />);

      const labelInput = screen.getByDisplayValue("SQL Query");
      fireEvent.change(labelInput, { target: { value: "New Query" } });

      expect(updateEdgeData).toHaveBeenCalledWith("edge-1", {
        label: "New Query",
      });
    });
  });

  describe("Edge Priority Over Node", () => {
    it("should show edge properties when both node and edge are selected", () => {
      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [sampleComponentNode, sampleDatabaseNode],
          edges: [sampleEdge],
          selectedNodeIds: ["component-1"],
          selectedEdgeIds: ["edge-1"],
        }),
      );

      render(<PropertiesPanel />);

      // Edge takes precedence
      expect(screen.getByText("Connection / Data Flow")).toBeInTheDocument();
      expect(screen.queryByText("Component")).not.toBeInTheDocument();
    });
  });

  describe("Edge with Missing Nodes", () => {
    it('should show "Unknown" for missing source/target nodes', () => {
      const edgeWithMissingNodes: Edge<ConnectionData> = {
        id: "edge-orphan",
        source: "missing-1",
        target: "missing-2",
        data: { label: "Orphan Edge" },
      };

      vi.mocked(useCanvasStore).mockImplementation(
        createMockStore({
          nodes: [], // No nodes
          edges: [edgeWithMissingNodes],
          selectedNodeIds: [],
          selectedEdgeIds: ["edge-orphan"],
        }),
      );

      render(<PropertiesPanel />);

      // Should show "Unknown" for missing nodes
      const unknownLabels = screen.getAllByText("Unknown");
      expect(unknownLabels.length).toBe(2);
    });
  });
});

describe("PropertiesPanel Styling", () => {
  it("should display styling section for components", () => {
    vi.mocked(useCanvasStore).mockImplementation(
      createMockStore({
        nodes: [sampleComponentNode],
        selectedNodeIds: ["component-1"],
        selectedEdgeIds: [],
      }),
    );

    render(<PropertiesPanel />);

    // Styling section header should be visible
    expect(screen.getByText("Styling")).toBeInTheDocument();
  });

  it("should display appearance section for boundaries", () => {
    vi.mocked(useCanvasStore).mockImplementation(
      createMockStore({
        nodes: [sampleBoundaryNode],
        selectedNodeIds: ["boundary-1"],
        selectedEdgeIds: [],
      }),
    );

    render(<PropertiesPanel />);

    // Appearance section with opacity slider
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Opacity")).toBeInTheDocument();
  });
});
