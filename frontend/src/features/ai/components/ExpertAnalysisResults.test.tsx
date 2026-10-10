import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExpertAnalysisResults } from "./ExpertAnalysisResults";
import type { ExpertAnalysisResult, ExpertAnalysisThreat } from "../types";

function makeThreat(
  overrides: Partial<ExpertAnalysisThreat> = {},
): ExpertAnalysisThreat {
  return {
    title: "Spoofing via stolen session token",
    description: "An attacker steals a session cookie and impersonates a user.",
    category: "SPOOFING",
    severity: "HIGH",
    confidence: 0.7,
    verifiedInPass5: false,
    ...overrides,
  };
}

function makeResult(threats: ExpertAnalysisThreat[]): ExpertAnalysisResult {
  return {
    threats,
    summary: {
      totalThreats: threats.length,
      strideCoverage: [],
      analysisTypes: [],
      passesCompleted: 6,
      verificationLoops: 1,
      duration: 1000,
    },
  };
}

// A failed Pass 5 verification must render a
// visibly failed state, not the same green "Verified in Pass 5" badge as a
// genuinely clean pass.
describe("ExpertAnalysisResults — verification failed state", () => {
  it("renders a failed-verification indicator when verificationFailed is set", () => {
    const threat = makeThreat({
      verifiedInPass5: false,
      verificationFailed: true,
    } as Partial<ExpertAnalysisThreat>);

    render(<ExpertAnalysisResults result={makeResult([threat])} />);

    expect(screen.getByTitle(/verification failed/i)).toBeTruthy();
  });

  it("does not render the failed indicator on a genuinely verified threat", () => {
    const threat = makeThreat({ verifiedInPass5: true });

    render(<ExpertAnalysisResults result={makeResult([threat])} />);

    expect(screen.queryByTitle(/verification failed/i)).toBeNull();
    expect(screen.getByTitle("Verified in Pass 5")).toBeTruthy();
  });
});
