/**
 * Org feature flag "agent-chain-v2" — unified 8-stage orchestrator.
 *
 * Extends the EXISTING per-org AI feature gating pattern: the flag lives in
 * `Organization.aiSettings` JSON under `features.agentChainV2` (same blob as
 * autoSuggestThreats / enableChat), and round-trips through the existing
 * PATCH /api/organizations/:orgId/ai-settings route — no new flag system.
 *
 * Default ON (1.0.0): the unified pipeline is the one the eval harness and
 * parity suites measure. A missing key, missing
 * settings blob, or unparsable JSON reads as enabled; only an explicit
 * `agentChainV2: false` opts an org back into the legacy pipeline. ai-worker
 * checks this accessor before routing an analysis job.
 */
import { getPrisma } from "../../db.js";
import logger from "../../utils/logger.js";
import type { AISettings } from "../../types/settings.js";

/** Public flag name used in admin UI / docs. Maps to features.agentChainV2. */
export const AGENT_CHAIN_V2_FLAG = "agent-chain-v2";

/** The flag exactly as stored: true/false when the org set it, undefined when unset. */
function readExplicitFlag(aiSettings: string | null): boolean | undefined {
  if (!aiSettings) return undefined;
  try {
    const value = (JSON.parse(aiSettings) as AISettings).features?.agentChainV2;
    return typeof value === "boolean" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Read the flag from a parsed/serialized aiSettings blob (pure). Unset = ON. */
export function readAgentChainV2(aiSettings: string | null): boolean {
  return readExplicitFlag(aiSettings) ?? true;
}

/**
 * Is the unified orchestrator enabled for this organization? Default ON, with
 * one safety net: an org that never set the flag only gets v2 when the built-in
 * pipeline is actually seeded. A deployment that has not run
 * `npm run seed:pipelines` keeps working on the legacy path (with a warning)
 * instead of failing every AI job. An explicit true/false is always honoured.
 */
export async function isAgentChainV2Enabled(
  organizationId: string,
): Promise<boolean> {
  const prisma = await getPrisma();
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { aiSettings: true },
  });
  const explicit = readExplicitFlag(org?.aiSettings ?? null);
  if (explicit !== undefined) return explicit;

  const seeded = await prisma.promptPipeline.findFirst({
    where: {
      name: "threat-analysis-v2",
      isBuiltIn: true,
      organizationId: null,
      isActive: true,
    },
    select: { id: true },
  });
  if (!seeded) {
    logger.warn(
      { organizationId },
      "agent-chain-v2 is the default but the threat-analysis-v2 pipeline is not seeded — using the legacy pipeline; run `npm run seed:pipelines`",
    );
  }
  return Boolean(seeded);
}
