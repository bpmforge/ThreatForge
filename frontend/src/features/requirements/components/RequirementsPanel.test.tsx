/**
 * RequirementsPanel — render coverage for the AI-suggested-review UI
 * (pending banner, accept/reject buttons, status badges).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequirementsPanel } from "./RequirementsPanel";
import type { Requirement } from "../types";

const mutate = vi.fn();

vi.mock("../hooks/useRequirements", () => ({
  useRequirements: vi.fn(),
  useCreateRequirement: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteRequirement: vi.fn(() => ({ mutate: vi.fn() })),
  useUpdateRequirement: vi.fn(() => ({ mutate, isPending: false })),
  useBulkCreateRequirements: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

import { useRequirements } from "../hooks/useRequirements";

function makeReq(overrides: Partial<Requirement>): Requirement {
  return {
    id: "r1",
    reqId: "REQ-1",
    text: "text",
    category: "security",
    docId: null,
    source: "MANUAL",
    reviewStatus: "ACCEPTED",
    reviewedAt: null,
    reviewedById: null,
    reviewNotes: null,
    frameworkId: null,
    threatModelId: "tm1",
    createdById: "u1",
    requirementFamilyId: "r1",
    version: 1,
    supersededAt: null,
    createdAt: "2026-04-20T00:00:00Z",
    updatedAt: "2026-04-20T00:00:00Z",
    _count: { mitigations: 0 },
    mitigations: [],
    ...overrides,
  };
}

function renderPanel(reqs: Requirement[]) {
  vi.mocked(useRequirements).mockReturnValue({
    data: reqs,
    isLoading: false,
  } as unknown as ReturnType<typeof useRequirements>);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RequirementsPanel modelId="tm1" />
    </QueryClientProvider>,
  );
}

describe("RequirementsPanel — AI suggestion review UI", () => {
  beforeEach(() => {
    mutate.mockReset();
  });

  it("shows the 'N AI suggestions awaiting review' banner when PENDING reqs exist", () => {
    renderPanel([
      makeReq({
        id: "r1",
        reqId: "SGR-A",
        source: "AI_SUGGESTED",
        reviewStatus: "PENDING",
      }),
      makeReq({
        id: "r2",
        reqId: "SGR-B",
        source: "AI_SUGGESTED",
        reviewStatus: "PENDING",
      }),
    ]);
    expect(
      screen.getByRole("button", {
        name: /2 AI-suggested requirements awaiting review/i,
      }),
    ).toBeInTheDocument();
  });

  it("hides the banner when no PENDING AI-suggested reqs exist", () => {
    renderPanel([makeReq({ source: "MANUAL", reviewStatus: "ACCEPTED" })]);
    expect(screen.queryByText(/awaiting review/i)).not.toBeInTheDocument();
  });

  it("renders Accept + Reject buttons on PENDING AI_SUGGESTED rows only", () => {
    renderPanel([
      makeReq({
        id: "r1",
        reqId: "SGR-A",
        source: "AI_SUGGESTED",
        reviewStatus: "PENDING",
      }),
      makeReq({
        id: "r2",
        reqId: "REQ-ACCEPTED",
        source: "MANUAL",
        reviewStatus: "ACCEPTED",
      }),
    ]);
    expect(
      screen.getByRole("button", { name: /Accept requirement SGR-A/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reject requirement SGR-A/i }),
    ).toBeInTheDocument();
    // Accepted manual row: no accept/reject controls
    expect(
      screen.queryByRole("button", {
        name: /Accept requirement REQ-ACCEPTED/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("Accept button invokes update with reviewStatus=ACCEPTED", () => {
    renderPanel([
      makeReq({
        id: "r1",
        reqId: "SGR-A",
        source: "AI_SUGGESTED",
        reviewStatus: "PENDING",
      }),
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: /Accept requirement SGR-A/i }),
    );
    expect(mutate).toHaveBeenCalledWith({
      id: "r1",
      input: { reviewStatus: "ACCEPTED" },
    });
  });

  it("Reject button invokes update with reviewStatus=REJECTED", () => {
    renderPanel([
      makeReq({
        id: "r1",
        reqId: "SGR-A",
        source: "AI_SUGGESTED",
        reviewStatus: "PENDING",
      }),
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: /Reject requirement SGR-A/i }),
    );
    expect(mutate).toHaveBeenCalledWith({
      id: "r1",
      input: { reviewStatus: "REJECTED" },
    });
  });

  it("REJECTED rows show a strikethrough 'Rejected' badge", () => {
    renderPanel([
      makeReq({
        id: "r1",
        reqId: "SGR-A",
        source: "AI_SUGGESTED",
        reviewStatus: "REJECTED",
      }),
    ]);
    expect(screen.getByText(/^Rejected$/)).toBeInTheDocument();
  });
});
