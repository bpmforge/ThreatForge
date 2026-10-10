/**
 * ArchitecturalMitigationsPanel tests
 * Accept / Reject / Modify call the update mutation; Suggest starts the job.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArchitecturalMitigationsPanel } from "./ArchitecturalMitigationsPanel";

const mockUpdate = vi.fn();
const mockAnalyze = vi.fn();
const mockUseList = vi.fn();

vi.mock("@/features/ai-jobs", () => ({
  JobProgressCard: ({ type }: { type: string }) => (
    <div data-testid="job-card">{type}</div>
  ),
}));

vi.mock("../hooks/useArchitecturalMitigations", () => ({
  useArchitecturalMitigations: () => mockUseList(),
  useUpdateArchitecturalMitigation: () => ({ mutate: mockUpdate }),
  useArchitecturalMitigationAnalysis: () => ({
    analyze: mockAnalyze,
    jobId: null,
    isStarting: false,
    onJobComplete: vi.fn(),
    dismissJob: vi.fn(),
  }),
}));

const item = {
  id: "am-1",
  threatModelId: "m1",
  kind: "ADD_WAF",
  title: "Add WAF",
  proposedChange: "Put a WAF in front of the API gateway",
  rationale: "Blocks injection",
  affectedComponentIds: ["c1"],
  affectedConnectionIds: [],
  threatIds: ["t1", "t2"],
  attackChainIds: [],
  priority: "HIGH",
  status: "AI_SUGGESTED",
  source: "AI",
  createdAt: "2026-10-01T00:00:00Z",
};

describe("ArchitecturalMitigationsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseList.mockReturnValue({ data: [item], isLoading: false });
  });

  it("renders the proposal with threat counts", () => {
    render(<ArchitecturalMitigationsPanel modelId="m1" />);
    expect(screen.getAllByText("Add WAF").length).toBeGreaterThan(0);
    expect(screen.getByText(/Addresses 2 threats/)).toBeTruthy();
  });

  it("Accept and Reject patch the status", () => {
    render(<ArchitecturalMitigationsPanel modelId="m1" />);
    fireEvent.click(screen.getByLabelText("Accept Add WAF"));
    expect(mockUpdate).toHaveBeenCalledWith({
      id: "am-1",
      patch: { status: "ACCEPTED" },
    });
    fireEvent.click(screen.getByLabelText("Reject Add WAF"));
    expect(mockUpdate).toHaveBeenLastCalledWith({
      id: "am-1",
      patch: { status: "REJECTED" },
    });
  });

  it("Modify saves an edited proposedChange", () => {
    render(<ArchitecturalMitigationsPanel modelId="m1" />);
    fireEvent.click(screen.getByLabelText("Modify Add WAF"));
    fireEvent.change(screen.getByLabelText("Proposed change"), {
      target: { value: "Managed WAF with OWASP CRS" },
    });
    fireEvent.click(screen.getByText("Save"));
    expect(mockUpdate).toHaveBeenCalledWith({
      id: "am-1",
      patch: { proposedChange: "Managed WAF with OWASP CRS" },
    });
  });

  it("Suggest starts the analysis job", () => {
    render(<ArchitecturalMitigationsPanel modelId="m1" />);
    fireEvent.click(screen.getByLabelText("Suggest architectural mitigations"));
    expect(mockAnalyze).toHaveBeenCalled();
  });

  it("shows an empty state", () => {
    mockUseList.mockReturnValue({ data: [], isLoading: false });
    render(<ArchitecturalMitigationsPanel modelId="m1" />);
    expect(screen.getByText(/No architectural proposals yet/)).toBeTruthy();
  });
});
