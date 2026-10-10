/**
 * AttackChainsPanel tests
 *
 * Covers the acceptance contract: list renders chains with severity → residual
 * and status; expanding shows hops; Accept/Reject call the status PATCH
 * mutation; Analyze enqueues the ATTACK_CHAIN_ANALYSIS job.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AttackChainsPanel } from "./AttackChainsPanel";

// Reused attack-paths hooks + overlay (mock the data/mutation surface).
const mockUpdateMutate = vi.fn();
vi.mock("@/features/attack-paths", () => ({
  AttackChainOverlay: () => null,
  useAttackChains: vi.fn(),
  useUpdateAttackChainStatus: () => ({ mutate: mockUpdateMutate }),
}));

// Job-polling card is exercised separately; stub it here.
vi.mock("@/features/ai-jobs", () => ({
  JobProgressCard: ({ type }: { type: string }) => (
    <div data-testid="job-card">{type}</div>
  ),
}));

// Analyze hook — assert analyze() is invoked.
const mockAnalyze = vi.fn();
vi.mock("../hooks/useAttackChainAnalysis", () => ({
  useAttackChainAnalysis: () => ({
    analyze: mockAnalyze,
    jobId: null,
    isStarting: false,
    onJobComplete: vi.fn(),
    dismissJob: vi.fn(),
  }),
}));

// Hop highlight reaches into the canvas store; stub it.
vi.mock("../hooks/useHopHighlight", () => ({
  useHopHighlight: () => ({ highlightHop: vi.fn(), clearHop: vi.fn() }),
}));

import { useAttackChains } from "@/features/attack-paths";

const chain = {
  id: "chain-1",
  name: "Public API to DB exfiltration",
  description: "Attacker pivots from edge to data store",
  severity: "CRITICAL",
  residualSeverity: "MEDIUM",
  status: "AI_SUGGESTED",
  entryPointId: "n-edge",
  entryPointName: "API Gateway",
  targetAssetId: "n-db",
  targetAssetName: "User Database",
  createdAt: "2026-06-13T00:00:00Z",
  hops: [
    {
      id: "hop-1",
      position: 1,
      componentId: "n-edge",
      componentName: "API Gateway",
      description: "Exploit missing auth on public route",
      isMitigated: false,
    },
    {
      id: "hop-2",
      position: 2,
      componentId: "n-db",
      componentName: "User Database",
      description: "Read all user records",
      isMitigated: true,
    },
  ],
};

function renderPanel() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AttackChainsPanel modelId="model-1" />
    </QueryClientProvider>,
  );
}

describe("AttackChainsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAttackChains).mockReturnValue({
      data: [chain],
      isLoading: false,
    } as unknown as ReturnType<typeof useAttackChains>);
  });

  it("renders the chain with severity, residual, and status", () => {
    renderPanel();
    expect(
      screen.getByText("Public API to DB exfiltration"),
    ).toBeInTheDocument();
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
    // Residual severity badge has an explicit aria-label.
    expect(
      screen.getByLabelText("Residual severity MEDIUM"),
    ).toBeInTheDocument();
    expect(screen.getByText("AI SUGGESTED")).toBeInTheDocument();
    expect(screen.getByText("API Gateway → User Database")).toBeInTheDocument();
  });

  it("does not show hops until expanded, then reveals them", () => {
    renderPanel();
    expect(
      screen.queryByText("Exploit missing auth on public route"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Expand hops"));

    expect(
      screen.getByText("Exploit missing auth on public route"),
    ).toBeInTheDocument();
    expect(screen.getByText("Read all user records")).toBeInTheDocument();
    expect(screen.getByText("(mitigated)")).toBeInTheDocument();
  });

  it("Accept calls the status PATCH mutation with ACCEPTED", () => {
    renderPanel();
    fireEvent.click(
      screen.getByLabelText("Accept chain Public API to DB exfiltration"),
    );
    expect(mockUpdateMutate).toHaveBeenCalledWith({
      chainId: "chain-1",
      status: "ACCEPTED",
    });
  });

  it("Reject calls the status PATCH mutation with REJECTED", () => {
    renderPanel();
    fireEvent.click(
      screen.getByLabelText("Reject chain Public API to DB exfiltration"),
    );
    expect(mockUpdateMutate).toHaveBeenCalledWith({
      chainId: "chain-1",
      status: "REJECTED",
    });
  });

  it("Analyze enqueues the analysis job", () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText("Analyze attack chains"));
    expect(mockAnalyze).toHaveBeenCalledOnce();
  });

  it("hides Accept/Reject for non-AI_SUGGESTED chains", () => {
    vi.mocked(useAttackChains).mockReturnValue({
      data: [{ ...chain, status: "ACCEPTED" }],
      isLoading: false,
    } as unknown as ReturnType<typeof useAttackChains>);
    renderPanel();
    expect(
      screen.queryByLabelText("Accept chain Public API to DB exfiltration"),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no chains", () => {
    vi.mocked(useAttackChains).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useAttackChains>);
    renderPanel();
    expect(screen.getByText(/No attack chains yet/i)).toBeInTheDocument();
  });

  it("expanded hop exposes a canvas-highlight control per hop", () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText("Expand hops"));
    const hopBtn = screen.getByLabelText("Highlight hop 1: API Gateway");
    expect(within(hopBtn).getByText("API Gateway")).toBeInTheDocument();
  });
});
