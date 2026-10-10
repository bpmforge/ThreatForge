/**
 * Mitigation provenance
 *
 * persistAIThreats clears a re-analysed threat's mitigations before writing the
 * AI's set. The predicate used to be threatId + status NOT_IMPLEMENTED +
 * verified false — both of which are the SCHEMA DEFAULTS, so it matched a
 * hand-written mitigation in its normal state and destroyed it on every rerun.
 *
 * These tests run deleteMany against a real in-memory store rather than
 * asserting the shape of the `where` clause: a wrong predicate elsewhere still
 * produces a right-looking `where`, but it cannot leave the right rows behind.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { persistAIThreats } from "../review-service.js";
import type { MicroThreat } from "../../ai/micro-analysis/types.js";

interface MitigationRow {
  id: string;
  threatId: string;
  source: "AI" | "HUMAN";
  status: "NOT_IMPLEMENTED" | "IMPLEMENTED";
  verified: boolean;
  description: string;
}

let store: MitigationRow[] = [];

/** Minimal deleteMany over `store`, honouring exactly the fields the caller filters on. */
const mockMitigationDeleteMany = vi.fn(
  async ({ where }: { where: Partial<MitigationRow> }) => {
    const before = store.length;
    store = store.filter(
      (row) =>
        !(Object.keys(where) as Array<keyof MitigationRow>).every(
          (k) => row[k] === where[k],
        ),
    );
    return { count: before - store.length };
  },
);

const mockMitigationCreate = vi.fn(
  async ({ data }: { data: Record<string, unknown> }) => {
    const row: MitigationRow = {
      id: `mit-${store.length + 1}`,
      threatId: data.threatId as string,
      source: (data.source as "AI" | "HUMAN") ?? "HUMAN",
      status: "NOT_IMPLEMENTED",
      verified: false,
      description: data.description as string,
    };
    store.push(row);
    return row;
  },
);

const mockThreatFindMany = vi.fn();
const mockThreatUpdate = vi.fn();

const mockPrisma = {
  threatModel: { findUnique: vi.fn() },
  component: { findMany: vi.fn() },
  threat: {
    findMany: mockThreatFindMany,
    update: mockThreatUpdate,
    create: vi.fn(),
  },
  mitigation: {
    create: mockMitigationCreate,
    deleteMany: mockMitigationDeleteMany,
  },
  requirement: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "req-1" }),
  },
  mitigationRequirement: { create: vi.fn().mockResolvedValue({}) },
};

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeThreat(mitigations: MicroThreat["mitigations"]): MicroThreat {
  return {
    name: "SQL Injection",
    description: "Test description",
    category: "TAMPERING",
    severity: "HIGH",
    componentId: "comp-1",
    componentName: "Test Component",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations,
    mitigation: { description: "", effort: "low", effectiveness: "0.5" },
    confidence: 0.9,
    sourceMethodology: "stride",
  };
}

const aiMitigation = {
  description: "Use parameterized queries",
  controlCategory: "INPUT_VALIDATION",
  testCriteria: "Verify prepared statements",
  effort: "LOW",
  effectiveness: "0.8",
};

describe("persistAIThreats — mitigation provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = [];

    mockPrisma.threatModel.findUnique.mockResolvedValue({ id: "model-1" });
    mockPrisma.component.findMany.mockResolvedValue([
      { id: "comp-1", nodeId: "node-1" },
    ]);
    mockThreatUpdate.mockResolvedValue({ id: "threat-1" });
    mockThreatFindMany.mockResolvedValue([
      {
        id: "threat-1",
        name: "SQL Injection",
        componentNodeId: "node-1",
        reviewStatus: "PENDING",
        source: "AI_SUGGESTED",
        manuallyEdited: false,
      },
    ]);
  });

  it("leaves a hand-written mitigation standing while replacing the AI one", async () => {
    store = [
      {
        id: "human-1",
        threatId: "threat-1",
        source: "HUMAN",
        status: "NOT_IMPLEMENTED",
        verified: false,
        description: "Hand-written remediation nobody has implemented yet",
      },
      {
        id: "ai-old",
        threatId: "threat-1",
        source: "AI",
        status: "NOT_IMPLEMENTED",
        verified: false,
        description: "Stale AI suggestion",
      },
    ];

    await persistAIThreats("model-1", "user-1", [makeThreat([aiMitigation])]);

    const survivors = store.map((m) => m.description);
    expect(survivors).toContain(
      "Hand-written remediation nobody has implemented yet",
    );
    expect(survivors).not.toContain("Stale AI suggestion");
    expect(survivors).toContain("Use parameterized queries");
  });

  it("leaves a template-instantiated mitigation standing", async () => {
    // Template instantiation sets none of controlCategory/testCriteria/
    // effectivenessScore, so the backfill classifies these HUMAN — the only
    // non-AI writer that was ever inside the delete predicate.
    store = [
      {
        id: "tpl-1",
        threatId: "threat-1",
        source: "HUMAN",
        status: "NOT_IMPLEMENTED",
        verified: false,
        description: "Template control",
      },
    ];

    await persistAIThreats("model-1", "user-1", [makeThreat([aiMitigation])]);

    expect(store.map((m) => m.description)).toContain("Template control");
  });

  it("still clears stale AI mitigations", async () => {
    store = [
      {
        id: "ai-old",
        threatId: "threat-1",
        source: "AI",
        status: "NOT_IMPLEMENTED",
        verified: false,
        description: "Stale AI suggestion",
      },
    ];

    await persistAIThreats("model-1", "user-1", [makeThreat([aiMitigation])]);

    expect(store.map((m) => m.description)).not.toContain(
      "Stale AI suggestion",
    );
  });

  it("does not touch an implemented or verified AI mitigation", async () => {
    store = [
      {
        id: "ai-done",
        threatId: "threat-1",
        source: "AI",
        status: "IMPLEMENTED",
        verified: false,
        description: "AI suggestion the team implemented",
      },
      {
        id: "ai-verified",
        threatId: "threat-1",
        source: "AI",
        status: "NOT_IMPLEMENTED",
        verified: true,
        description: "AI suggestion the team verified",
      },
    ];

    await persistAIThreats("model-1", "user-1", [makeThreat([aiMitigation])]);

    const survivors = store.map((m) => m.description);
    expect(survivors).toContain("AI suggestion the team implemented");
    expect(survivors).toContain("AI suggestion the team verified");
  });

  it("writes new mitigations tagged AI so the next rerun may replace them", async () => {
    await persistAIThreats("model-1", "user-1", [makeThreat([aiMitigation])]);

    const created = mockMitigationCreate.mock.calls[0][0].data;
    expect(created.source).toBe("AI");
  });
});
