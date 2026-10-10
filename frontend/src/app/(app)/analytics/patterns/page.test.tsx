import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SystemicPatternsPage from "./page";

const hook = vi.hoisted(() => ({ result: {} as Record<string, unknown> }));

vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
vi.mock("@/stores/org-store", () => ({ useCurrentOrgId: () => "org-1" }));
vi.mock("@/features/organizations/hooks/useOrganization", () => ({
  useOrganizations: () => ({ data: [{ id: "org-1" }] }),
}));
vi.mock("@/features/reports/hooks/useSystemicPatterns", () => ({
  useSystemicPatterns: () => hook.result,
}));

describe("SystemicPatternsPage", () => {
  it("renders recurring patterns with counts, severity mix and affected models", () => {
    hook.result = {
      isLoading: false,
      error: null,
      data: {
        organizationId: "org-1",
        minModels: 2,
        totalModels: 4,
        patterns: [
          {
            kind: "name",
            key: "sql injection",
            label: "SQL Injection",
            modelCount: 3,
            threatCount: 3,
            unmitigatedCount: 2,
            severityMix: { CRITICAL: 1, HIGH: 2 },
            maxSeverity: "CRITICAL",
            affectedModels: [
              {
                id: "m1",
                name: "Billing API",
                projectName: "Payments",
                threatCount: 1,
                unmitigatedCount: 1,
              },
            ],
          },
        ],
      },
    };
    render(<SystemicPatternsPage />);
    expect(screen.getByText("SQL Injection")).toBeTruthy();
    expect(screen.getByText("CRITICAL 1")).toBeTruthy();
    expect(screen.getByText(/Billing API/)).toBeTruthy();
    expect(screen.getByText("/4")).toBeTruthy();
  });

  it("shows an empty state when nothing recurs", () => {
    hook.result = {
      isLoading: false,
      error: null,
      data: {
        organizationId: "org-1",
        minModels: 2,
        totalModels: 1,
        patterns: [],
      },
    };
    render(<SystemicPatternsPage />);
    expect(screen.getByText("No recurring patterns")).toBeTruthy();
  });
});
