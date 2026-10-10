import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineStageTimeline } from "./PipelineStageTimeline";
import type { PipelineStageExecution } from "../types";

/**
 * The cost/latency UI must render for a UNIFIED `threat-analysis-v2` run,
 * including a stage that was served from the stage cache. A cache hit has
 * the signature COMPLETED + durationMs === 0 + tokensUsed > 0 (see
 * utils/stage-metrics.ts), which the timeline surfaces as a "Cached" badge and
 * $0.00 cost while still showing the original token count.
 */
function makeStage(
  over: Partial<PipelineStageExecution>,
): PipelineStageExecution {
  return {
    id: "se-1",
    stageId: "stage-1",
    order: 0,
    status: "COMPLETED",
    durationMs: 1200,
    tokensUsed: 4200,
    retryAttempts: 0,
    ...over,
  };
}

describe("PipelineStageTimeline (unified run cost/latency)", () => {
  const stages: PipelineStageExecution[] = [
    makeStage({
      id: "s1",
      stageId: "ArchitectureReader",
      durationMs: 800,
      tokensUsed: 1500,
    }),
    // Cache hit: 0ms, original tokens preserved on the row.
    makeStage({
      id: "s2",
      stageId: "ThreatIdentifier",
      durationMs: 0,
      tokensUsed: 9000,
    }),
    makeStage({
      id: "s3",
      stageId: "Verifier",
      durationMs: 2300,
      tokensUsed: 3100,
    }),
  ];

  it("renders per-stage duration for executed stages", () => {
    render(<PipelineStageTimeline stages={stages} />);
    expect(screen.getByText("800ms")).toBeTruthy();
    expect(screen.getByText("2300ms")).toBeTruthy();
  });

  it("renders per-stage token counts", () => {
    render(<PipelineStageTimeline stages={stages} />);
    // 9,000 cached-stage tokens shown with the (cached) suffix.
    expect(screen.getByText(/9,000 \(cached\)/)).toBeTruthy();
    expect(screen.getByText("1,500")).toBeTruthy();
  });

  it("surfaces a Cached badge for stages served from the stage cache", () => {
    render(<PipelineStageTimeline stages={stages} />);
    const cached = screen.getAllByText("Cached");
    expect(cached.length).toBe(1);
  });

  it("renders a per-stage cost estimate, $0.00 for cache hits", () => {
    render(<PipelineStageTimeline stages={stages} />);
    // 1500 tokens * $0.0005/1k = $0.00075 -> $0.0008 (4dp sub-cent).
    expect(screen.getByText("$0.0008")).toBeTruthy();
    // Cache hit contributes no new spend this run.
    expect(screen.getAllByText("$0.00").length).toBeGreaterThanOrEqual(1);
  });

  it("marks icon decorations aria-hidden (no redundant a11y noise)", () => {
    const { container } = render(<PipelineStageTimeline stages={stages} />);
    expect(
      container.querySelectorAll('[aria-hidden="true"]').length,
    ).toBeGreaterThan(0);
  });
});
