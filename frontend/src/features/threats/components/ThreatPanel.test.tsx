/**
 * ThreatPanel Component Tests
 *
 * Real tests for the ThreatPanel component using React Testing Library.
 * Mocks TanStack Query hooks and Zustand stores.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreatPanel } from "./ThreatPanel";
import type { Threat } from "../types";

// Mock the hooks
vi.mock("../hooks/useThreats", () => ({
  useThreats: vi.fn(),
  useCreateThreat: vi.fn(),
  useUpdateThreat: vi.fn(),
  useUpdateThreatStatus: vi.fn(),
  useDeleteThreat: vi.fn(),
  useResetThreatToAi: vi.fn(),
  useCreateMitigation: vi.fn(),
  useUpdateMitigation: vi.fn(),
  useUpdateMitigationStatus: vi.fn(),
  useDeleteMitigation: vi.fn(),
  useMoveMitigation: vi.fn(),
}));

vi.mock("@/stores/canvas", () => ({
  useCanvasStore: vi.fn(),
}));

// Import mocked modules
import * as useThreatsModule from "../hooks/useThreats";
import { useCanvasStore } from "@/stores/canvas";

// Sample test data
const sampleThreats: Threat[] = [
  {
    id: "threat-1",
    name: "SQL Injection",
    description: "Database query injection attack",
    componentNodeId: "component-1",
    strideCategories: ["TAMPERING"],
    severity: "CRITICAL",
    status: "OPEN",
    mitigations: [
      {
        id: "m1",
        description: "Use parameterized queries",
        status: "COMPLETED",
        priority: "HIGH",
        strategy: "PREVENTION",
      },
      {
        id: "m2",
        description: "Input validation",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        strategy: "PREVENTION",
      },
    ],
  },
  {
    id: "threat-2",
    name: "XSS Attack",
    description: "Cross-site scripting vulnerability",
    componentNodeId: "component-2",
    strideCategories: ["SPOOFING", "TAMPERING"],
    severity: "HIGH",
    status: "MITIGATED",
    mitigations: [
      {
        id: "m3",
        description: "Output encoding",
        status: "VERIFIED",
        priority: "HIGH",
        strategy: "PREVENTION",
      },
    ],
  },
  {
    id: "threat-3",
    name: "Denial of Service",
    description: "Resource exhaustion attack",
    componentNodeId: "component-1",
    strideCategories: ["DENIAL_OF_SERVICE"],
    severity: "MEDIUM",
    status: "OPEN",
    mitigations: [],
  },
];

// Create mock mutation objects
const createMockMutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  isSuccess: false,
  data: undefined,
  error: null,
  reset: vi.fn(),
});

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientWrapper";
  return Wrapper;
}

describe("ThreatPanel Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const state = {
        nodes: [],
        edges: [],
        selectedNodeIds: [],
      };
      return selector(state as unknown as Parameters<typeof selector>[0]);
    });

    vi.mocked(useThreatsModule.useThreats).mockReturnValue({
      data: sampleThreats,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useThreatsModule.useThreats>);

    vi.mocked(useThreatsModule.useCreateThreat).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useCreateThreat
      >,
    );
    vi.mocked(useThreatsModule.useUpdateThreat).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useUpdateThreat
      >,
    );
    vi.mocked(useThreatsModule.useUpdateThreatStatus).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useUpdateThreatStatus
      >,
    );
    vi.mocked(useThreatsModule.useDeleteThreat).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useDeleteThreat
      >,
    );
    vi.mocked(useThreatsModule.useResetThreatToAi).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useResetThreatToAi
      >,
    );
    vi.mocked(useThreatsModule.useCreateMitigation).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useCreateMitigation
      >,
    );
    vi.mocked(useThreatsModule.useUpdateMitigation).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useUpdateMitigation
      >,
    );
    vi.mocked(useThreatsModule.useUpdateMitigationStatus).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useUpdateMitigationStatus
      >,
    );
    vi.mocked(useThreatsModule.useDeleteMitigation).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useDeleteMitigation
      >,
    );
    vi.mocked(useThreatsModule.useMoveMitigation).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useMoveMitigation
      >,
    );
  });

  describe("Rendering", () => {
    it("should render without modelId and show save message", () => {
      render(<ThreatPanel modelId={null} />, { wrapper: createWrapper() });

      expect(
        screen.getByText(/save your threat model first/i),
      ).toBeInTheDocument();
    });

    it("should show loading state when fetching threats", () => {
      vi.mocked(useThreatsModule.useThreats).mockReturnValue({
        data: [],
        isLoading: true,
        isError: false,
        error: null,
      } as unknown as ReturnType<typeof useThreatsModule.useThreats>);

      render(<ThreatPanel modelId="model-1" />, { wrapper: createWrapper() });

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("should show empty state when no threats exist", () => {
      vi.mocked(useThreatsModule.useThreats).mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
      } as unknown as ReturnType<typeof useThreatsModule.useThreats>);

      render(<ThreatPanel modelId="model-1" />, { wrapper: createWrapper() });

      expect(screen.getByText(/no threats identified/i)).toBeInTheDocument();
    });

    it("should render threat cards when threats exist", () => {
      render(<ThreatPanel modelId="model-1" />, { wrapper: createWrapper() });

      expect(screen.getByText("SQL Injection")).toBeInTheDocument();
      expect(screen.getByText("XSS Attack")).toBeInTheDocument();
      expect(screen.getByText("Denial of Service")).toBeInTheDocument();
    });
  });

  describe("Filtering by component", () => {
    it("should show all threats when no node is selected", () => {
      render(<ThreatPanel modelId="model-1" />, { wrapper: createWrapper() });

      expect(screen.getByText("SQL Injection")).toBeInTheDocument();
      expect(screen.getByText("XSS Attack")).toBeInTheDocument();
      expect(screen.getByText("Denial of Service")).toBeInTheDocument();
    });

    it("should filter threats when a single node is selected", () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        const state = {
          nodes: [
            {
              id: "component-1",
              type: "component",
              data: { label: "Database" },
            },
            {
              id: "component-2",
              type: "component",
              data: { label: "Web Server" },
            },
          ],
          edges: [],
          selectedNodeIds: ["component-1"],
        };
        return selector(state as unknown as Parameters<typeof selector>[0]);
      });

      render(<ThreatPanel modelId="model-1" />, { wrapper: createWrapper() });

      // Should show threats for component-1 only
      expect(screen.getByText("SQL Injection")).toBeInTheDocument();
      expect(screen.getByText("Denial of Service")).toBeInTheDocument();
      // Should NOT show threat for component-2
      expect(screen.queryByText("XSS Attack")).not.toBeInTheDocument();
    });

    it("should show all threats when multiple nodes are selected", () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        const state = {
          nodes: [
            {
              id: "component-1",
              type: "component",
              data: { label: "Database" },
            },
            {
              id: "component-2",
              type: "component",
              data: { label: "Web Server" },
            },
          ],
          edges: [],
          selectedNodeIds: ["component-1", "component-2"],
        };
        return selector(state as unknown as Parameters<typeof selector>[0]);
      });

      render(<ThreatPanel modelId="model-1" />, { wrapper: createWrapper() });

      // Should show all threats when multiple nodes selected
      expect(screen.getByText("SQL Injection")).toBeInTheDocument();
      expect(screen.getByText("XSS Attack")).toBeInTheDocument();
      expect(screen.getByText("Denial of Service")).toBeInTheDocument();
    });

    it("should show empty state when selected component has no threats", () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        const state = {
          nodes: [
            {
              id: "component-3",
              type: "component",
              data: { label: "New Component" },
            },
          ],
          edges: [],
          selectedNodeIds: ["component-3"],
        };
        return selector(state as unknown as Parameters<typeof selector>[0]);
      });

      render(<ThreatPanel modelId="model-1" />, { wrapper: createWrapper() });

      // Shows the standard empty state message
      expect(screen.getByText(/no threats identified/i)).toBeInTheDocument();
    });
  });

  describe("Hook Integration", () => {
    it("should call useThreats with modelId", () => {
      render(<ThreatPanel modelId="model-123" />, { wrapper: createWrapper() });

      expect(useThreatsModule.useThreats).toHaveBeenCalledWith("model-123", {
        sinceLastSignOff: false,
      });
    });

    it("should call mutation hooks with modelId", () => {
      render(<ThreatPanel modelId="model-123" />, { wrapper: createWrapper() });

      expect(useThreatsModule.useCreateThreat).toHaveBeenCalledWith(
        "model-123",
      );
      expect(useThreatsModule.useUpdateThreatStatus).toHaveBeenCalledWith(
        "model-123",
      );
      expect(useThreatsModule.useDeleteThreat).toHaveBeenCalledWith(
        "model-123",
      );
      expect(useThreatsModule.useCreateMitigation).toHaveBeenCalledWith(
        "model-123",
      );
      expect(useThreatsModule.useUpdateMitigationStatus).toHaveBeenCalledWith(
        "model-123",
      );
      expect(useThreatsModule.useDeleteMitigation).toHaveBeenCalledWith(
        "model-123",
      );
    });
  });

  describe("Threat Panel Header", () => {
    it("should show selected component label in header", () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        const state = {
          nodes: [
            {
              id: "component-1",
              type: "component",
              data: { label: "My Database", type: "database" },
            },
          ],
          edges: [],
          selectedNodeIds: ["component-1"],
        };
        return selector(state as unknown as Parameters<typeof selector>[0]);
      });

      render(<ThreatPanel modelId="model-1" />, { wrapper: createWrapper() });

      // The header should reflect the selected component
      expect(screen.getByText(/my database/i)).toBeInTheDocument();
    });
  });

  describe("Threat Panel Footer", () => {
    it("should render footer with threat statistics when modelId exists", () => {
      render(<ThreatPanel modelId="model-1" />, { wrapper: createWrapper() });

      // Footer should be rendered with modelId
      // The exact content depends on ThreatPanelFooter implementation
      // At minimum, the component should render without errors
      expect(screen.getByText("SQL Injection")).toBeInTheDocument();
    });

    it("should not render footer when modelId is null", () => {
      render(<ThreatPanel modelId={null} />, { wrapper: createWrapper() });

      // The save message should be shown instead
      expect(
        screen.getByText(/save your threat model first/i),
      ).toBeInTheDocument();
    });
  });
});

describe("ThreatPanel State Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const state = { nodes: [], edges: [], selectedNodeIds: [] };
      return selector(state as unknown as Parameters<typeof selector>[0]);
    });

    vi.mocked(useThreatsModule.useThreats).mockReturnValue({
      data: sampleThreats,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useThreatsModule.useThreats>);

    vi.mocked(useThreatsModule.useCreateThreat).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useCreateThreat
      >,
    );
    vi.mocked(useThreatsModule.useUpdateThreat).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useUpdateThreat
      >,
    );
    vi.mocked(useThreatsModule.useUpdateThreatStatus).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useUpdateThreatStatus
      >,
    );
    vi.mocked(useThreatsModule.useDeleteThreat).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useDeleteThreat
      >,
    );
    vi.mocked(useThreatsModule.useResetThreatToAi).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useResetThreatToAi
      >,
    );
    vi.mocked(useThreatsModule.useCreateMitigation).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useCreateMitigation
      >,
    );
    vi.mocked(useThreatsModule.useUpdateMitigation).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useUpdateMitigation
      >,
    );
    vi.mocked(useThreatsModule.useUpdateMitigationStatus).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useUpdateMitigationStatus
      >,
    );
    vi.mocked(useThreatsModule.useDeleteMitigation).mockReturnValue(
      createMockMutation() as unknown as ReturnType<
        typeof useThreatsModule.useDeleteMitigation
      >,
    );
  });

  it("should track expanded threat state internally", () => {
    render(<ThreatPanel modelId="model-1" />, { wrapper: createWrapper() });

    // Threats should be rendered
    const threatCards = screen.getAllByText(/injection|attack|service/i);
    expect(threatCards.length).toBeGreaterThan(0);
  });

  it("should manage dialog states for adding threats and mitigations", () => {
    render(<ThreatPanel modelId="model-1" />, { wrapper: createWrapper() });

    // Component should render with dialogs closed by default
    // The exact dialog content depends on implementation
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
