/**
 * Duplicate-rate measurement over recorded fixtures — no LLM, no DB.
 *
 * - replay: the committed llm-journal.json replayed through the legacy
 *   pipeline tail (persist-free). The
 *   duplicate guard runs inside it; its LLM adjudication call is not in the
 *   journal, so it fails closed (ReplayMiss → pairs stay in review) and this
 *   measures the DETECTOR-ONLY guard. Full features: names, descriptions,
 *   CWEs, mitigations.
 * - seeds: every recorded seed (seeds/*.json), names / category / component
 *   only, scored before and after a detector-only guard pass.
 *
 * Duplicate rate = surplus members of merge- or review-band clusters / threats
 * (duplicate-detector.ts duplicateRate). "Before" is the set as the pipeline
 * produced it (after the existing LLM dedup); "after" is post-guard.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runMicroAnalysis } from "../../services/ai/micro-analysis/pipeline.js";
import type { MicroThreat } from "../../services/ai/micro-analysis/types.js";
import type { DuplicateGuardMetrics } from "../../services/ai/dedup/duplicate-guard.js";
import { runDuplicateGuard } from "../../services/ai/dedup/duplicate-guard.js";
import { createReplayAICaller } from "./replay-ai.js";
import { loadFixtureContext } from "./fixture-context.js";

export const GO_FORWARD_DIR = join(
  import.meta.dirname,
  "..",
  "fixtures",
  "go-forward",
);

export async function measureReplay(): Promise<DuplicateGuardMetrics> {
  const context = loadFixtureContext(GO_FORWARD_DIR);
  const result = await runMicroAnalysis(
    context,
    createReplayAICaller(join(GO_FORWARD_DIR, "llm-journal.json"), "replay"),
    { methodologies: ["stride"] },
  );
  if (!result.summary.dedup) throw new Error("summary.dedup missing");
  return result.summary.dedup;
}

interface SeedEntry {
  name: string;
  category: string;
  severity: MicroThreat["severity"];
  componentId?: string;
}

export interface SeedMeasurement {
  seed: string;
  threats: number;
  before: number;
  after: number;
  merged: number;
  reviewPairs: number;
}

export async function measureSeeds(): Promise<SeedMeasurement[]> {
  const names = new Map(
    loadFixtureContext(GO_FORWARD_DIR).components.map((c) => [c.id, c.name]),
  );
  const dir = join(GO_FORWARD_DIR, "seeds");
  const out: SeedMeasurement[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.startsWith("golden-seed-") || !file.endsWith(".json")) continue;
    const seed = JSON.parse(
      readFileSync(join(dir, file), "utf8"),
    ) as SeedEntry[];
    const threats: MicroThreat[] = seed.map((s) => ({
      name: s.name,
      description: "",
      category: s.category,
      severity: s.severity,
      componentId: s.componentId ?? "compound",
      componentName: names.get(s.componentId ?? "") ?? "Cross-Component",
      cweIds: [],
      owaspIds: [],
      evidence: {},
      mitigations: [],
      mitigation: { description: "", effort: "", effectiveness: "" },
      confidence: 0.7,
      sourceMethodology: "stride",
    }));
    const { metrics } = await runDuplicateGuard(threats);
    out.push({
      seed: file.replace(/^golden-seed-|\.json$/g, ""),
      threats: metrics.threatsIn,
      before: metrics.duplicateRateBefore,
      after: metrics.duplicateRateAfter,
      merged: metrics.merged,
      reviewPairs: metrics.reviewPairs,
    });
  }
  return out;
}
