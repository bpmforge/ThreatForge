/**
 * Severity Calibrator
 *
 * After all threats are collected, this pass calibrates severities
 * with full context. A threat rated MEDIUM in isolation might be
 * CRITICAL when it sits on an attack chain to a database.
 *
 * Works with or without LLM:
 * - Rule-based: bump severity for attack-chain threats, restricted data, no controls
 * - LLM-enhanced: AI reviews all severities for consistency
 */
import type { AttackChain } from "../../threat-generation/attack-chain-analyzer.js";
import { extractJsonArray } from "../response-parsers.js";
import {
  getEpssScores,
  EPSS_LOW_THRESHOLD,
} from "../../vuln-intel/epss-client.js";
import type { AICallFn, MicroThreat } from "./types.js";
import logger from "../../../utils/logger.js";

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const SEVERITY_UP: Record<string, MicroThreat["severity"]> = {
  LOW: "MEDIUM",
  MEDIUM: "HIGH",
  HIGH: "CRITICAL",
  CRITICAL: "CRITICAL",
};

const SEVERITY_DOWN: Record<string, MicroThreat["severity"]> = {
  CRITICAL: "HIGH",
  HIGH: "MEDIUM",
  MEDIUM: "LOW",
  LOW: "LOW",
};

/**
 * Closed whitelist of severities MicroThreat["severity"] accepts. Same
 * four values SEVERITY_UP/SEVERITY_DOWN are keyed on. Any LLM-returned
 * severity outside this set must never be cast straight into the field: it
 * eventually hits review-service.ts's write to the Prisma `Severity` enum,
 * which throws on an out-of-enum value and wipes the scoped session.
 */
const VALID_SEVERITIES = new Set<MicroThreat["severity"]>([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
]);

/**
 * Calibrate severities across all threats with full context.
 * Also deduplicates threats with the same name+component.
 */
export async function calibrateSeverities(
  aiCall: AICallFn | undefined,
  threats: MicroThreat[],
  attackChains: AttackChain[],
  opts?: { epssEnabled?: boolean },
): Promise<MicroThreat[]> {
  // --- Step 1: Dedup (same name + same component → keep highest severity) ---
  const deduped = deduplicateThreats(threats);

  // --- Step 2: Rule-based calibration (always runs) ---
  const chainComponentIds = new Set(
    attackChains.flatMap((c) => c.steps.map((s) => s.componentId)),
  );

  for (const threat of deduped) {
    // Threats on components in attack chains get severity bumped
    if (chainComponentIds.has(threat.componentId)) {
      threat.severity = SEVERITY_UP[threat.severity];
    }
  }

  // --- Step 2b: EPSS calibration (optional, gated by org policy) ---
  // High CVSS + very low EPSS = systematically over-prioritized. Downgrade one
  // level when every linked CVE is unlikely to be exploited (EPSS < threshold).
  if (opts?.epssEnabled) {
    await applyEpssCalibration(deduped);
  }

  // --- Step 3: LLM calibration (optional, single call) ---
  if (aiCall && deduped.length >= 5) {
    try {
      const adjustments = await llmCalibrate(aiCall, deduped);
      for (const adj of adjustments) {
        const threat = findAdjustedThreat(deduped, adj);
        if (!threat || !adj.severity) continue;
        if (VALID_SEVERITIES.has(adj.severity as MicroThreat["severity"])) {
          threat.severity = adj.severity as MicroThreat["severity"];
        } else {
          // Unknown severity from the LLM: fall back to MEDIUM rather
          // than propagate a value that throws at the Prisma enum write.
          logger.warn(
            { badSeverity: adj.severity, threatName: adj.name },
            "LLM severity calibration returned an unrecognized severity value; falling back to MEDIUM",
          );
          threat.severity = "MEDIUM";
        }
      }
    } catch (err) {
      logger.warn({ err }, "LLM severity calibration failed, using rule-based");
    }
  }

  // --- Step 4: Sort by severity ---
  deduped.sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5),
  );

  return deduped;
}

/**
 * Lower severity for threats whose linked CVEs all have very low EPSS scores.
 * Only downgrades when EPSS data exists and every score is below the threshold
 * — a single likely-exploited CVE keeps the original severity.
 */
async function applyEpssCalibration(threats: MicroThreat[]): Promise<void> {
  const allCves = [...new Set(threats.flatMap((t) => t.cveIds ?? []))];
  if (allCves.length === 0) return;

  const scores = await getEpssScores(allCves);
  if (scores.size === 0) return;

  for (const threat of threats) {
    const cves = threat.cveIds ?? [];
    const known = cves
      .map((c) => scores.get(c))
      .filter((s): s is number => s !== undefined);
    if (known.length === 0) continue;
    const maxEpss = Math.max(...known);
    if (maxEpss < EPSS_LOW_THRESHOLD) {
      threat.severity = SEVERITY_DOWN[threat.severity];
    }
  }
}

/**
 * Resolve which threat an LLM adjustment refers to. Threats are unique per
 * (componentId, name) so the name alone is ambiguous when the same threat name
 * sits on several components. The prompt only asks for `name`, so an adjustment
 * may optionally carry `componentId` (or `component`, the component's name)
 * when the model echoes it. With a component hint, match on component + name.
 * Without one, apply only when the name is unique; an ambiguous name is skipped
 * rather than silently re-rating whichever component happens to come first.
 */
function findAdjustedThreat(
  threats: MicroThreat[],
  adj: LlmAdjustment,
): MicroThreat | undefined {
  const name = adj.name?.toLowerCase();
  if (!name) return undefined;
  let matches = threats.filter((t) => t.name.toLowerCase() === name);
  const hint = adj.componentId ?? adj.component;
  if (hint) {
    const h = hint.toLowerCase();
    matches = matches.filter(
      (t) =>
        t.componentId.toLowerCase() === h ||
        t.componentName?.toLowerCase() === h,
    );
  }
  if (matches.length > 1) {
    logger.warn(
      { threatName: adj.name, candidates: matches.length },
      "LLM severity adjustment is ambiguous across components; skipping",
    );
    return undefined;
  }
  return matches[0];
}

function deduplicateThreats(threats: MicroThreat[]): MicroThreat[] {
  const seen = new Map<string, MicroThreat>();
  for (const t of threats) {
    const key = `${t.componentId}:${t.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const existing = seen.get(key);
    if (
      !existing ||
      (SEVERITY_ORDER[t.severity] ?? 5) <
        (SEVERITY_ORDER[existing.severity] ?? 5)
    ) {
      seen.set(key, t);
    }
  }
  return [...seen.values()];
}

interface LlmAdjustment {
  name: string;
  severity: string;
  /** Optional — the prompt does not ask for these; used when the model echoes them. */
  componentId?: string;
  component?: string;
}

async function llmCalibrate(
  aiCall: AICallFn,
  threats: MicroThreat[],
): Promise<LlmAdjustment[]> {
  const shown = threats.slice(0, 25);
  const summary = shown
    .map(
      (t) =>
        `- "${t.name}" [${t.componentName}] ${t.severity} (${t.category}) componentId=${t.componentId}`,
    )
    .join("\n");

  // State the SHOWN count (only the first 25 are listed), and ask the
  // model to echo componentId so same-named threats on different components
  // can be told apart.
  const raw = await aiCall(
    "You review threat severities for consistency. Return ONLY adjustments needed as a JSON array. If all severities are correct, return [].",
    `Review these ${shown.length} threat severities. Return adjustments only:\n${summary}\n\nReturn: [{"name":"threat name","componentId":"<echo the componentId shown>","severity":"CRITICAL|HIGH|MEDIUM|LOW","reason":"brief reason"}]`,
    "calibration",
  );

  const arr = extractJsonArray(raw);
  if (!arr) return [];
  return arr as LlmAdjustment[];
}
