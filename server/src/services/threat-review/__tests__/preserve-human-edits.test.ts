/**
 * Preserve Human Edits Tests
 *
 * Verifies that persistAIThreats skips manually-edited threats and
 * continues to update non-edited PENDING threats normally.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { persistAIThreats } from "../review-service.js";
import type { MicroThreat } from "../../ai/micro-analysis/types.js";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockThreatUpdate = vi.fn();
const mockThreatCreate = vi.fn();

const mockPrisma = {
  threatModel: {
    findUnique: vi.fn(),
  },
  component: {
    findMany: vi.fn(),
  },
  threat: {
    findMany: vi.fn(),
    update: mockThreatUpdate,
    create: mockThreatCreate,
  },
  mitigation: {
    create: vi.fn(),
  },
};

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

// Silence logger during tests
vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMicroThreat(
  name: string,
  componentId: string,
  description = "AI description",
): MicroThreat {
  return {
    name,
    description,
    category: "TAMPERING",
    severity: "HIGH",
    componentId,
    componentName: "Test Component",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "low", effectiveness: "0.5" },
    confidence: 0.9,
    sourceMethodology: "stride",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("persistAIThreats — preserve human edits", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Model always exists
    mockPrisma.threatModel.findUnique.mockResolvedValue({ id: "model-1" });

    // Component map: DB id "comp-1" → React Flow nodeId "node-1"
    mockPrisma.component.findMany.mockResolvedValue([
      { id: "comp-1", nodeId: "node-1" },
    ]);

    mockPrisma.mitigation.create.mockResolvedValue({ id: "mit-1" });
  });

  it("skips a manually-edited PENDING threat on AI re-run", async () => {
    // Seed: threat with manuallyEdited=true, still PENDING
    mockPrisma.threat.findMany.mockResolvedValue([
      {
        id: "threat-1",
        name: "Test Threat",
        componentNodeId: "node-1",
        reviewStatus: "PENDING",
        source: "AI_SUGGESTED",
        manuallyEdited: true,
      },
    ]);

    const aiThreats = [makeMicroThreat("Test Threat", "comp-1", "New AI desc")];

    const result = await persistAIThreats("model-1", "user-1", aiThreats);

    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.created).toBe(0);
    expect(mockThreatUpdate).not.toHaveBeenCalled();
  });

  it("updates a non-edited PENDING threat normally (regression guard)", async () => {
    // Seed: threat with manuallyEdited=false, PENDING
    mockPrisma.threat.findMany.mockResolvedValue([
      {
        id: "threat-2",
        name: "Another Threat",
        componentNodeId: "node-1",
        reviewStatus: "PENDING",
        source: "AI_SUGGESTED",
        manuallyEdited: false,
      },
    ]);

    mockThreatUpdate.mockResolvedValue({ id: "threat-2" });

    const aiThreats = [
      makeMicroThreat("Another Threat", "comp-1", "Updated AI description"),
    ];

    const result = await persistAIThreats("model-1", "user-1", aiThreats);

    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockThreatUpdate).toHaveBeenCalledOnce();

    const updateCall = mockThreatUpdate.mock.calls[0][0];
    expect(updateCall.data.description).toBe("Updated AI description");
  });
});
