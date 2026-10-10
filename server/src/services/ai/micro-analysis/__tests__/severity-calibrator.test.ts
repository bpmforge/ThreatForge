/**
 * severity-calibrator.ts casts `adj.severity` from the LLM's
 * calibration response into MicroThreat["severity"] without validating it
 * against the closed whitelist. Downstream, review-service.ts writes that
 * string straight into the Prisma `Severity` enum column (threat-review/
 * review-service.ts:277,357); an out-of-enum value throws there and the
 * scoped session gets wiped (ai-worker.ts's FAILED path).
 *
 * These tests lock in: (1) an invalid severity value falls back to MEDIUM
 * with a logger.warn carrying the bad value, never propagates verbatim;
 * (2) a valid whitelist value still applies normally; (3) the calibration
 * prompt states the SHOWN count, not just the true total, when threats are
 * truncated to the first 25.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { calibrateSeverities } from "../severity-calibrator.js";
import type { MicroThreat } from "../types.js";

const warnMock = vi.fn();
vi.mock("../../../../utils/logger.js", () => ({
  default: {
    info: vi.fn(),
    warn: (...args: unknown[]) => warnMock(...args),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function makeThreat(overrides: Partial<MicroThreat> = {}): MicroThreat {
  return {
    name: "Stub threat",
    description: "desc",
    category: "TAMPERING",
    severity: "LOW",
    componentId: "web",
    componentName: "Web App",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "low", effectiveness: "0.5" },
    confidence: 0.8,
    sourceMethodology: "stride",
    ...overrides,
  };
}

describe("calibrateSeverities — severity-cast validation", () => {
  beforeEach(() => {
    warnMock.mockClear();
  });

  it("falls back to MEDIUM and logs a warning when the LLM returns an out-of-whitelist severity", async () => {
    // >=5 threats required to trigger the LLM calibration call path.
    const threats = Array.from({ length: 5 }, (_, i) =>
      makeThreat({ name: `T${i}`, severity: "LOW" }),
    );
    const aiCall = vi
      .fn()
      .mockResolvedValue(JSON.stringify([{ name: "T0", severity: "URGENT" }]));

    const result = await calibrateSeverities(aiCall, threats, []);

    const t0 = result.find((t) => t.name === "T0");
    expect(t0?.severity).toBe("MEDIUM");
    expect(warnMock).toHaveBeenCalled();
    const warnCall = warnMock.mock.calls.find((c) =>
      JSON.stringify(c).includes("URGENT"),
    );
    expect(warnCall).toBeTruthy();
  });

  it("applies a valid whitelist severity normally", async () => {
    const threats = Array.from({ length: 5 }, (_, i) =>
      makeThreat({ name: `T${i}`, severity: "LOW" }),
    );
    const aiCall = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify([{ name: "T0", severity: "CRITICAL" }]),
      );

    const result = await calibrateSeverities(aiCall, threats, []);

    expect(result.find((t) => t.name === "T0")?.severity).toBe("CRITICAL");
  });

  it("states the shown count (not the total) when more than 25 threats exist", async () => {
    const threats = Array.from({ length: 30 }, (_, i) =>
      makeThreat({ name: `T${i}`, severity: "LOW", componentId: `c${i}` }),
    );
    const aiCall = vi.fn().mockResolvedValue("[]");
    await calibrateSeverities(aiCall, threats, []);
    const user = aiCall.mock.calls[0][1] as string;
    expect(user).toContain("Review these 25 threat severities");
    expect(user).not.toContain("30 threat");
    expect(user).toContain("componentId=c0");
  });

  it("matches an adjustment to the echoed componentId when names repeat", async () => {
    const threats = [
      ...Array.from({ length: 4 }, (_, i) =>
        makeThreat({ name: `T${i}`, severity: "LOW", componentId: `c${i}` }),
      ),
      makeThreat({ name: "T0", severity: "LOW", componentId: "other" }),
    ];
    const aiCall = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify([
          { name: "T0", componentId: "other", severity: "CRITICAL" },
        ]),
      );
    const result = await calibrateSeverities(aiCall, threats, []);
    const bySev = result
      .filter((t) => t.name === "T0")
      .map((t) => `${t.componentId}:${t.severity}`)
      .sort();
    expect(bySev).toEqual(["c0:LOW", "other:CRITICAL"]);
  });
});

describe("calibrateSeverities — component-scoped adjustment matching", () => {
  function sameNameAcrossComponents() {
    return [
      makeThreat({
        name: "SQL Injection",
        componentId: "c1",
        componentName: "API",
        severity: "LOW",
      }),
      makeThreat({
        name: "SQL Injection",
        componentId: "c2",
        componentName: "Worker",
        severity: "LOW",
      }),
      ...Array.from({ length: 3 }, (_, i) =>
        makeThreat({ name: `Other${i}`, componentId: "c3", severity: "LOW" }),
      ),
    ];
  }

  it("applies an adjustment only to the component it names", async () => {
    const aiCall = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify([
          { name: "SQL Injection", componentId: "c2", severity: "CRITICAL" },
        ]),
      );
    const result = await calibrateSeverities(
      aiCall,
      sameNameAcrossComponents(),
      [],
    );
    const sev = (id: string) =>
      result.find((t) => t.name === "SQL Injection" && t.componentId === id)
        ?.severity;
    expect(sev("c1")).toBe("LOW");
    expect(sev("c2")).toBe("CRITICAL");
  });

  it("matches on component name when the model echoes it", async () => {
    const aiCall = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify([
          { name: "SQL Injection", component: "API", severity: "HIGH" },
        ]),
      );
    const result = await calibrateSeverities(
      aiCall,
      sameNameAcrossComponents(),
      [],
    );
    expect(
      result.find((t) => t.componentId === "c1" && t.name === "SQL Injection")
        ?.severity,
    ).toBe("HIGH");
    expect(
      result.find((t) => t.componentId === "c2" && t.name === "SQL Injection")
        ?.severity,
    ).toBe("LOW");
  });

  it("skips an ambiguous name with no component hint instead of re-rating the first match", async () => {
    const aiCall = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify([{ name: "SQL Injection", severity: "CRITICAL" }]),
      );
    const result = await calibrateSeverities(
      aiCall,
      sameNameAcrossComponents(),
      [],
    );
    for (const t of result.filter((t) => t.name === "SQL Injection")) {
      expect(t.severity).toBe("LOW");
    }
  });
});
