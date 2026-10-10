import { CoverageStatus } from "../types/coverage";

const EXPECTED_THREATS: Record<string, number> = {
  PROCESS: 6,
  DATA_STORE: 4,
  EXTERNAL_ENTITY: 2,
  DATA_FLOW: 3,
};

export function getExpectedThreats(componentType: string): number {
  return EXPECTED_THREATS[componentType] ?? 4;
}

export function calculateCoverageStatus(
  threatCount: number,
  expected: number,
): CoverageStatus {
  if (threatCount === 0) return "uncovered";
  const percentage = (threatCount / expected) * 100;
  return percentage >= 80 ? "covered" : "partial";
}
