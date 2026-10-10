/**
 * seed:pipelines idempotency proof — real SQLite test DB, no mocks.
 *
 * Runs the threat-analysis-v2 seed twice and asserts row counts and stage
 * ids are unchanged, and that the seeded rows are shaped the way
 * pipeline-service resolves them (inputMapping sources are real stage ids).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { setupTestDatabase, teardownTestDatabase } from "./setup.js";
import {
  seedThreatAnalysisV2Pipeline,
  PIPELINE_NAME,
} from "../../scripts/seed-pipelines.js";
import { THREAT_ANALYSIS_STAGE_NAMES } from "../services/ai/stages/registry.js";

describe("seed-pipelines (threat-analysis-v2)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("seeds once, then a second run changes nothing (idempotent)", async () => {
    const first = await seedThreatAnalysisV2Pipeline(prisma);
    const second = await seedThreatAnalysisV2Pipeline(prisma);

    // No duplicate pipeline, no duplicate stages
    expect(
      await prisma.promptPipeline.count({ where: { name: PIPELINE_NAME } }),
    ).toBe(1);
    expect(
      await prisma.pipelineStage.count({
        where: { pipelineId: first.pipelineId },
      }),
    ).toBe(8);

    // Updated in place: same pipeline id, same stage ids
    expect(second.pipelineId).toBe(first.pipelineId);
    expect(second.stageIds).toEqual(first.stageIds);
  });

  it("seeds the 8 stages in §2.1 order with the §2.2 stage names", async () => {
    const { pipelineId } = await seedThreatAnalysisV2Pipeline(prisma);
    const pipeline = await prisma.promptPipeline.findUnique({
      where: { id: pipelineId },
      include: { stages: { orderBy: { order: "asc" } } },
    });

    expect(pipeline?.isSequential).toBe(true);
    expect(pipeline?.stopOnError).toBe(false);
    expect(pipeline?.isBuiltIn).toBe(true);
    expect(pipeline?.stages.map((s) => s.name)).toEqual([
      ...THREAT_ANALYSIS_STAGE_NAMES,
    ]);

    // The Verifier is a required challenger gate, not optional.
    const verifier = pipeline?.stages.find((s) => s.name === "Verifier");
    expect(verifier?.optional).toBe(false);

    // Code-backed stages carry the handler sentinel, not a template id
    for (const stage of pipeline?.stages ?? []) {
      expect(stage.promptTemplateId).toBe(`handler:${stage.name}`);
    }
  });

  it("chains inputMapping to real predecessor stage ids and named outputs", async () => {
    const { stageIds } = await seedThreatAnalysisV2Pipeline(prisma);
    const stages = await prisma.pipelineStage.findMany({
      where: { id: { in: Object.values(stageIds) } },
    });
    const byName = new Map(stages.map((s) => [s.name, s]));
    const allIds = new Set(Object.values(stageIds));

    // Every inputMapping ref is a {value} literal (e.g. fanOut) OR a
    // {source, field} lookup from "input" / an existing stage id.
    for (const stage of stages) {
      const mapping = JSON.parse(stage.inputMapping) as Record<
        string,
        { source?: string; field?: string; value?: unknown }
      >;
      for (const ref of Object.values(mapping)) {
        if ("value" in ref) continue; // pipeline-definition literal
        expect(
          ref.source === "input" || allIds.has(ref.source ?? ""),
          `${stage.name} maps from unknown source ${ref.source}`,
        ).toBe(true);
        expect(ref.field).toBeTruthy();
      }
    }

    // Spot-check the §2.1 chain semantics
    const identifier = JSON.parse(byName.get("ThreatIdentifier")!.inputMapping);
    expect(identifier.componentContexts.source).toBe(
      stageIds.ArchitectureReader,
    );
    expect(JSON.parse(byName.get("ThreatIdentifier")!.outputFields)).toEqual([
      "threats",
      "parseFailures",
      "attackChains", // ride-along for SeverityCalibrator
      "llmCalls",
      "skippedComponentCount", // ride-along for the legacy result summary
      "failedUnits", // fan-out partial-failure units
      "fanOutUnitCount", // fan-out child count
    ]);

    // ThreatIdentifier's fanOut default is a pipeline-definition literal.
    expect(identifier.fanOut).toEqual({ value: true });

    const enricher = JSON.parse(byName.get("EvidenceEnricher")!.inputMapping);
    expect(enricher.threats).toEqual({
      source: stageIds.ThreatIdentifier,
      field: "threats",
    });

    // StrideClassifier condition keys into the flattened <stageId>.<field> form
    const classifier = byName.get("StrideClassifier")!;
    expect(JSON.parse(classifier.condition!)).toEqual({
      field: `${stageIds.ArchitectureReader}.methodology`,
      equals: "STRIDE",
    });

    // MitigationSynthesizer maps both enriched and classified threat lists
    const synth = JSON.parse(byName.get("MitigationSynthesizer")!.inputMapping);
    expect(synth.threats.source).toBe(stageIds.EvidenceEnricher);
    expect(synth.classifiedThreats.source).toBe(stageIds.StrideClassifier);
  });
});
