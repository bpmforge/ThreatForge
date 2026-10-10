/**
 * buildThreatModelContext with synthesized HLA enrichment.
 *
 * We test the enrichment logic directly without hitting the database by
 * exercising the helper functions that transform the data.
 */
import { describe, it, expect } from "vitest";
import type {
  ExtractionResult,
  CoverageMetrics,
} from "../../../services/ai/extraction-agent.js";

// ---------------------------------------------------------------------------
// Pure-logic helpers extracted for unit testing
// (mirrors what buildThreatModelContext does with synthesizedHLA)
// ---------------------------------------------------------------------------

interface CanvasComponent {
  id: string;
  name: string;
  type: string;
  trustLevel?: string | null;
  technology?: string | null;
  dataClassification?: string | null;
  properties?: string | null;
  confidence?: number | null;
}

interface CanvasConnection {
  id: string;
  sourceComponentId: string;
  targetComponentId: string;
  label?: string | null;
  protocol?: string | null;
  encrypted: boolean;
}

function enrichComponents(
  canvasComponents: CanvasComponent[],
  hla: ExtractionResult,
) {
  const hlaByName = new Map(
    hla.components.map((c) => [c.name.toLowerCase().trim(), c]),
  );

  return canvasComponents.map((c) => {
    const h = hlaByName.get(c.name.toLowerCase().trim());
    return {
      id: c.id,
      name: c.name,
      trustZone: c.trustLevel ?? h?.trustLevel ?? undefined,
      properties: {
        technology: c.technology ?? h?.technology ?? undefined,
        dataClassification:
          c.dataClassification ?? h?.dataClassification?.join(",") ?? undefined,
        verificationStatus: h?.verificationStatus ?? undefined,
        sourceQuote: h?.sourceText ?? undefined,
        sourceDocument: h?.sourceDocument ?? undefined,
        confidence: c.confidence ?? h?.confidence ?? undefined,
      },
    };
  });
}

function injectHLAFlows(
  canvasComponents: CanvasComponent[],
  canvasConnections: CanvasConnection[],
  hla: ExtractionResult,
) {
  const canvasIdByName = new Map(
    canvasComponents.map((c) => [c.name.toLowerCase().trim(), c.id]),
  );
  const existingPairs = new Set(
    canvasConnections.map(
      (c) => `${c.sourceComponentId}→${c.targetComponentId}`,
    ),
  );

  const injected: Array<{ id: string; source: string; target: string }> = [];

  for (const flow of hla.dataFlows) {
    const srcComp = hla.components.find((c) => c.id === flow.sourceId);
    const tgtComp = hla.components.find((c) => c.id === flow.targetId);
    const srcId = srcComp
      ? canvasIdByName.get(srcComp.name.toLowerCase().trim())
      : undefined;
    const tgtId = tgtComp
      ? canvasIdByName.get(tgtComp.name.toLowerCase().trim())
      : undefined;
    if (!srcId || !tgtId) continue;
    const pair = `${srcId}→${tgtId}`;
    if (existingPairs.has(pair)) continue;
    existingPairs.add(pair);
    injected.push({ id: `hla-${flow.id}`, source: srcId, target: tgtId });
  }

  return injected;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CANVAS_COMPONENTS: CanvasComponent[] = [
  { id: "canvas-pg", name: "PostgreSQL", type: "DATABASE" },
  { id: "canvas-api", name: "API Gateway", type: "SERVICE" },
];

const CANVAS_CONNECTIONS: CanvasConnection[] = [
  {
    id: "conn-1",
    sourceComponentId: "canvas-api",
    targetComponentId: "canvas-pg",
    encrypted: true,
  },
];

function makeHLA(overrides?: Partial<ExtractionResult>): ExtractionResult {
  return {
    components: [
      {
        id: "hla-pg",
        name: "PostgreSQL",
        type: "DATABASE",
        confidence: 0.95,
        sourceText: "PostgreSQL is the primary data store.",
        sourceDocument: "SAD.pdf",
        verificationStatus: "VERIFIED",
        trustLevel: "HIGH",
        technology: "PostgreSQL 17",
        dataClassification: ["pii", "internal"],
      },
      {
        id: "hla-api",
        name: "API Gateway",
        type: "SERVICE",
        confidence: 0.9,
        sourceText: "API Gateway authenticates sensor certificates.",
        sourceDocument: "SAD.pdf",
        verificationStatus: "VERIFIED",
        trustLevel: "MEDIUM",
      },
    ],
    dataFlows: [
      {
        id: "flow-sensor-api",
        sourceId: "hla-sensor",
        targetId: "hla-api",
        label: "sensor payload",
        confidence: 0.85,
      },
      {
        id: "flow-api-pg",
        sourceId: "hla-api",
        targetId: "hla-pg",
        label: "store record",
        confidence: 0.9,
      },
    ],
    boundaries: [],
    dependencies: [],
    mlComponents: [],
    technologies: ["PostgreSQL"],
    dataTypes: [],
    confidence: 0.92,
    warnings: [],
    passesCompleted: 2,
    coverageMetrics: {
      componentsCoverage: 90,
      flowsCoverage: 80,
      boundariesCoverage: 0,
      quotesCoverage: 90,
      overallScore: 88,
    } as unknown as CoverageMetrics,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildThreatModelContext HLA enrichment", () => {
  describe("enrichComponents", () => {
    it("enriches canvas component with HLA verificationStatus and sourceQuote", () => {
      const result = enrichComponents(CANVAS_COMPONENTS, makeHLA());

      const pg = result.find((c) => c.name === "PostgreSQL")!;
      expect(pg.properties.verificationStatus).toBe("VERIFIED");
      expect(pg.properties.sourceQuote).toBe(
        "PostgreSQL is the primary data store.",
      );
      expect(pg.properties.sourceDocument).toBe("SAD.pdf");
    });

    it("enriches technology from HLA when canvas has none", () => {
      const result = enrichComponents(CANVAS_COMPONENTS, makeHLA());

      const pg = result.find((c) => c.name === "PostgreSQL")!;
      expect(pg.properties.technology).toBe("PostgreSQL 17");
    });

    it("prefers canvas technology over HLA when canvas has it", () => {
      const comps = [
        { ...CANVAS_COMPONENTS[0], technology: "PostgreSQL 14 (canvas value)" },
      ];
      const result = enrichComponents(comps, makeHLA());

      expect(result[0].properties.technology).toBe(
        "PostgreSQL 14 (canvas value)",
      );
    });

    it("joins dataClassification array from HLA", () => {
      const result = enrichComponents(CANVAS_COMPONENTS, makeHLA());

      const pg = result.find((c) => c.name === "PostgreSQL")!;
      expect(pg.properties.dataClassification).toBe("pii,internal");
    });

    it("enriches trustZone from HLA when canvas has none", () => {
      const result = enrichComponents(CANVAS_COMPONENTS, makeHLA());

      const pg = result.find((c) => c.name === "PostgreSQL")!;
      expect(pg.trustZone).toBe("HIGH");
    });

    it("returns component unchanged when no HLA match exists", () => {
      const comps: CanvasComponent[] = [
        { id: "c-orphan", name: "Unknown Service", type: "SERVICE" },
      ];
      const result = enrichComponents(comps, makeHLA());

      expect(result[0].properties.verificationStatus).toBeUndefined();
      expect(result[0].properties.sourceQuote).toBeUndefined();
    });

    it("is case-insensitive for name matching", () => {
      const comps: CanvasComponent[] = [
        { id: "c1", name: "POSTGRESQL", type: "DATABASE" },
      ];
      const result = enrichComponents(comps, makeHLA());

      expect(result[0].properties.verificationStatus).toBe("VERIFIED");
    });
  });

  describe("injectHLAFlows", () => {
    it("injects HLA flow when both endpoints exist on canvas", () => {
      // hla-api → hla-pg exists in HLA; canvas has canvas-api and canvas-pg
      const injected = injectHLAFlows(
        CANVAS_COMPONENTS,
        [], // no existing canvas connections
        makeHLA(),
      );

      // connection from api to pg should be injected
      expect(
        injected.some(
          (f) => f.source === "canvas-api" && f.target === "canvas-pg",
        ),
      ).toBe(true);
    });

    it("does not duplicate existing canvas connections", () => {
      const injected = injectHLAFlows(
        CANVAS_COMPONENTS,
        CANVAS_CONNECTIONS, // api→pg already exists
        makeHLA(),
      );

      // api→pg was already in CANVAS_CONNECTIONS, so it should NOT be duplicated
      const apiPgFlows = injected.filter(
        (f) => f.source === "canvas-api" && f.target === "canvas-pg",
      );
      expect(apiPgFlows).toHaveLength(0);
    });

    it("skips HLA flows where source or target not on canvas", () => {
      // flow-sensor-api has sourceId hla-sensor which has no canvas counterpart
      const injected = injectHLAFlows(CANVAS_COMPONENTS, [], makeHLA());

      expect(injected.every((f) => f.source !== undefined)).toBe(true);
      // sensor is not on canvas so that flow should be absent
      expect(injected.every((f) => f.id !== "hla-flow-sensor-api")).toBe(true);
    });

    it("returns empty array when HLA has no data flows", () => {
      const injected = injectHLAFlows(
        CANVAS_COMPONENTS,
        [],
        makeHLA({ dataFlows: [] }),
      );

      expect(injected).toHaveLength(0);
    });
  });
});
