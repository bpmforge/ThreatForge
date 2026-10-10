import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { MicroThreat } from "../micro-analysis/types.js";
import { normalizeThreatName } from "../../threat-review/normalize-threat-name.js";
import {
  persistSharedControls,
  SHARED_CONTROL_MARKER,
} from "./shared-controls.js";

function threat(
  name: string,
  componentId: string,
  severity: MicroThreat["severity"] = "MEDIUM",
): MicroThreat {
  return {
    name,
    description: "",
    category: "TAMPERING",
    severity,
    componentId,
    componentName: componentId,
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "", effectiveness: "" },
    confidence: 0.7,
    sourceMethodology: "stride",
  };
}

const archCreate = vi.fn();
const archDeleteMany = vi.fn();
const prisma = {
  threat: { findMany: vi.fn() },
  architecturalMitigation: {
    findMany: vi.fn(),
    create: archCreate,
    deleteMany: archDeleteMany,
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      architecturalMitigation: {
        create: archCreate,
        deleteMany: archDeleteMany,
      },
    }),
  ),
} as unknown as PrismaClient & {
  threat: { findMany: ReturnType<typeof vi.fn> };
  architecturalMitigation: { findMany: ReturnType<typeof vi.fn> };
};

const SQLI = "SQL Injection in Order Persistence";
const MITM = "Client-Side Parameter Manipulation and Injection";
const control = "Use parameterized queries for every database write.";

describe("persistSharedControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.threat.findMany.mockResolvedValue([
      {
        id: "t-sqli",
        componentNodeId: "node-order",
        connectionEdgeId: null,
        normalizedName: normalizeThreatName(SQLI),
      },
    ]);
    prisma.architecturalMitigation.findMany.mockResolvedValue([
      {
        id: "old-guard-row",
        status: "AI_SUGGESTED",
        source: "AI",
        rationale: `${SHARED_CONTROL_MARKER} old`,
        proposedChange: "old",
      },
      {
        id: "llm-row",
        status: "AI_SUGGESTED",
        source: "AI",
        rationale: "Add a WAF",
        proposedChange: "waf",
      },
    ]);
  });

  it("creates one OTHER row listing every threat the shared control closes (linked threats resolve to the existing row)", async () => {
    const res = await persistSharedControls({
      prisma,
      threatModelId: "tm",
      sessionId: "s",
      dbIdToNodeId: new Map([
        ["comp-order", "node-order"],
        ["comp-user", "node-user"],
      ]),
      groups: [
        {
          control,
          threats: [
            threat(SQLI, "comp-order", "HIGH"),
            threat(MITM, "comp-user"),
          ],
        },
      ],
      linked: [
        {
          name: MITM,
          componentNodeId: "node-user",
          existingThreatId: "human-1",
          score: 0.9,
        },
      ],
    });
    expect(res.created).toBe(1);
    // Replaces only its own previous rows, never the LLM job's proposals.
    expect(archDeleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["old-guard-row"] },
        status: "AI_SUGGESTED",
        source: "AI",
      },
    });
    const data = archCreate.mock.calls[0][0].data;
    expect(data.kind).toBe("OTHER");
    expect(JSON.parse(data.threatIds)).toEqual(["t-sqli", "human-1"]);
    expect(JSON.parse(data.affectedComponentIds)).toEqual([
      "comp-order",
      "comp-user",
    ]);
    expect(data.priority).toBe("HIGH");
    expect(data.rationale.startsWith(SHARED_CONTROL_MARKER)).toBe(true);
    expect(data.proposedChange).toBe(control);
  });

  it("skips a group with fewer than two resolvable threats and writes nothing", async () => {
    const res = await persistSharedControls({
      prisma,
      threatModelId: "tm",
      sessionId: "s",
      dbIdToNodeId: new Map([["comp-order", "node-order"]]),
      groups: [
        {
          control,
          threats: [
            threat(SQLI, "comp-order"),
            threat("Not persisted", "comp-order"),
          ],
        },
      ],
    });
    expect(res.created).toBe(0);
    expect(archCreate).not.toHaveBeenCalled();
    expect(archDeleteMany).not.toHaveBeenCalled();
  });

  it("does not re-suggest a control a human already reviewed", async () => {
    prisma.threat.findMany.mockResolvedValue([
      {
        id: "a",
        componentNodeId: "node-order",
        connectionEdgeId: null,
        normalizedName: normalizeThreatName(SQLI),
      },
      {
        id: "b",
        componentNodeId: "node-user",
        connectionEdgeId: null,
        normalizedName: normalizeThreatName(MITM),
      },
    ]);
    prisma.architecturalMitigation.findMany.mockResolvedValue([
      {
        id: "rejected",
        status: "REJECTED",
        source: "AI",
        rationale: `${SHARED_CONTROL_MARKER} x`,
        proposedChange: control,
      },
    ]);
    const res = await persistSharedControls({
      prisma,
      threatModelId: "tm",
      sessionId: "s",
      dbIdToNodeId: new Map([
        ["comp-order", "node-order"],
        ["comp-user", "node-user"],
      ]),
      groups: [
        {
          control,
          threats: [threat(SQLI, "comp-order"), threat(MITM, "comp-user")],
        },
      ],
    });
    expect(res.created).toBe(0);
  });
});
