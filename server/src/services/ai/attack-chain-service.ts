/**
 * Attack Chain AI Service
 *
 * 5-pass pipeline that identifies multi-hop attack paths through a system
 * diagram and returns structured chain data for persistence.
 *
 * Pass 1 — Entry point detection
 * Pass 2 — Target asset detection
 * Pass 3 — Path generation (per entry→target pair, max 5 pairs)
 * Pass 4 — Validation (remove chains that break connection rules)
 * Pass 5 — Mitigation mapping (link hops to existing threats)
 */
import type { ThreatModelContext, AIProviderClient } from "../../types/ai.js";
import {
  entryPointPrompt,
  targetAssetPrompt,
  pathGenerationPrompt,
  validationPrompt,
} from "./attack-chain-prompts.js";
import { extractJsonArray, extractJsonObject } from "./response-parsers.js";
import logger from "../../utils/logger.js";

const MAX_CHAINS = 10;
const MAX_HOPS = 8;
const MAX_PAIRS = 5;

interface GeneratedHop {
  position: number;
  componentId: string;
  componentName: string;
  description: string;
  technique?: string;
  threatId?: string;
}

interface GeneratedChain {
  name: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  entryPointId: string;
  entryPointName: string;
  targetAssetId: string;
  targetAssetName: string;
  hops: GeneratedHop[];
}

export interface AttackChainResult {
  chains: GeneratedChain[];
  sessionId: string;
  /**
   * True when `chains` is empty because the LLM output could not be parsed
   * or validated at some pass (as opposed to a genuine "no attack chains
   * found" result, e.g. the model legitimately has no entry points). The
   * caller (ai-worker.ts ATTACK_CHAIN_ANALYSIS) uses this to distinguish
   * "nothing to report" from "the analysis failed" — only the latter should
   * surface as a job failure, and neither should ever wipe an existing,
   * validated set of chains.
   */
  failed: boolean;
}

/** Call the AI with a plain prompt string and return the raw text. */
async function aiCall(
  client: AIProviderClient,
  prompt: string,
): Promise<string> {
  const resp = await client.complete({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    maxTokens: 45000,
  });
  return resp.content;
}

/** Coerce an unknown raw hop object to GeneratedHop or null. */
function toHop(raw: unknown, idx: number): GeneratedHop | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.componentId !== "string" || typeof r.componentName !== "string")
    return null;
  return {
    position: typeof r.position === "number" ? r.position : idx + 1,
    componentId: r.componentId,
    componentName: r.componentName,
    description: typeof r.description === "string" ? r.description : "",
    technique: typeof r.technique === "string" ? r.technique : undefined,
  };
}

type PartialChain = Omit<
  GeneratedChain,
  "entryPointId" | "entryPointName" | "targetAssetId" | "targetAssetName"
>;

/** Coerce a raw LLM object to a partial chain (without entry/target metadata). */
function toRawChain(raw: unknown): PartialChain | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const severity = (r.severity as string | undefined)?.toUpperCase();
  if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(severity ?? ""))
    return null;
  const rawHops = Array.isArray(r.hops) ? r.hops : [];
  const hops = rawHops
    .slice(0, MAX_HOPS)
    .map((h: unknown, i: number) => toHop(h, i))
    .filter((h): h is GeneratedHop => h !== null);
  if (hops.length === 0) return null;
  return {
    name: typeof r.name === "string" ? r.name : "Unnamed chain",
    description: typeof r.description === "string" ? r.description : "",
    severity: severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    hops,
  };
}

/**
 * Generate attack chains for a threat model via a 5-pass AI pipeline.
 */
export async function generateAttackChains(
  client: AIProviderClient,
  context: ThreatModelContext,
  existingThreats: Array<{
    id: string;
    name: string;
    componentNodeId?: string | null;
  }>,
  sessionId: string,
): Promise<AttackChainResult> {
  // Track parse/validation failures separately from "the LLM legitimately
  // found nothing" so the caller can tell a malformed reply (should fail the
  // job, must not touch existing chains) apart from a genuine zero-chains
  // result (a normal outcome, also must not touch existing chains).
  let sawMalformedOutput = false;

  // Pass 1 — Entry points
  let entryPoints: Array<{ id: string; name: string }> = [];
  try {
    const raw = await aiCall(client, entryPointPrompt(context));
    const items = extractJsonArray(raw);
    if (items === null) sawMalformedOutput = true;
    entryPoints = (items ?? [])
      .filter(
        (i): i is { id: string; name: string } =>
          typeof (i as Record<string, unknown>).id === "string" &&
          typeof (i as Record<string, unknown>).name === "string",
      )
      .filter((e) => context.components.some((c) => c.id === e.id));
  } catch (err) {
    sawMalformedOutput = true;
    logger.warn({ err }, "attack-chain pass1: entry point detection failed");
  }

  // Pass 2 — Target assets
  let targets: Array<{ id: string; name: string }> = [];
  try {
    const raw = await aiCall(client, targetAssetPrompt(context));
    const items = extractJsonArray(raw);
    if (items === null) sawMalformedOutput = true;
    targets = (items ?? [])
      .filter(
        (i): i is { id: string; name: string } =>
          typeof (i as Record<string, unknown>).id === "string" &&
          typeof (i as Record<string, unknown>).name === "string",
      )
      .filter((t) => context.components.some((c) => c.id === t.id));
  } catch (err) {
    sawMalformedOutput = true;
    logger.warn({ err }, "attack-chain pass2: target asset detection failed");
  }

  if (entryPoints.length === 0 || targets.length === 0) {
    logger.info("attack-chain: no entry/target pairs found, returning empty");
    return { chains: [], sessionId, failed: sawMalformedOutput };
  }

  // Build pairs (max MAX_PAIRS)
  const pairs: Array<{
    entry: { id: string; name: string };
    target: { id: string; name: string };
  }> = [];
  outer: for (const entry of entryPoints) {
    for (const target of targets) {
      if (entry.id !== target.id) {
        pairs.push({ entry, target });
        if (pairs.length >= MAX_PAIRS) break outer;
      }
    }
  }

  // Pass 3 — Path generation (sequential to avoid overwhelming LLM)
  const rawChains: GeneratedChain[] = [];
  for (const { entry, target } of pairs) {
    if (rawChains.length >= MAX_CHAINS) break;
    try {
      const prompt = pathGenerationPrompt(
        context,
        entry.id,
        entry.name,
        target.id,
        target.name,
      );
      const raw = await aiCall(client, prompt);
      const obj = extractJsonObject(raw);
      const partial = toRawChain(obj);
      if (partial) {
        rawChains.push({
          ...partial,
          entryPointId: entry.id,
          entryPointName: entry.name,
          targetAssetId: target.id,
          targetAssetName: target.name,
        });
      } else {
        // The call succeeded but the reply didn't parse into a usable chain
        // (bad JSON, missing severity/hops) — that's malformed, not "no path
        // for this pair".
        sawMalformedOutput = true;
      }
    } catch (err) {
      sawMalformedOutput = true;
      logger.warn(
        { err, entryId: entry.id, targetId: target.id },
        "attack-chain pass3: path gen failed for pair",
      );
    }
  }

  if (rawChains.length === 0) {
    return { chains: [], sessionId, failed: sawMalformedOutput };
  }

  // Pass 4 — Validation (filter chains whose hops break connection rules)
  let validChains = rawChains;
  try {
    const prompt = validationPrompt(context, rawChains);
    const raw = await aiCall(client, prompt);
    const items = extractJsonArray(raw);
    if (items && items.length > 0) {
      const rehydrated = items
        .map((item) => {
          const obj = item as Record<string, unknown>;
          const partial = toRawChain(item);
          if (!partial) return null;
          const original = rawChains.find((c) => c.name === obj.name);
          if (!original) return null;
          return {
            ...partial,
            entryPointId: original.entryPointId,
            entryPointName: original.entryPointName,
            targetAssetId: original.targetAssetId,
            targetAssetName: original.targetAssetName,
          } as GeneratedChain;
        })
        .filter((c): c is GeneratedChain => c !== null);
      if (rehydrated.length > 0) validChains = rehydrated;
    }
  } catch (err) {
    logger.warn(
      { err },
      "attack-chain pass4: validation failed, keeping raw chains",
    );
  }

  // Pass 5 — Map existing threat IDs onto matching hops by componentNodeId
  const threatsByComponent = new Map<string, string>();
  for (const threat of existingThreats) {
    if (threat.componentNodeId) {
      threatsByComponent.set(threat.componentNodeId, threat.id);
    }
  }

  const finalChains = validChains.slice(0, MAX_CHAINS).map((chain) => ({
    ...chain,
    hops: chain.hops.map((hop) => ({
      ...hop,
      threatId: threatsByComponent.get(hop.componentId) ?? undefined,
    })),
  }));

  return { chains: finalChains, sessionId, failed: false };
}
