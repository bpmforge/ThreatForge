/**
 * AI Provider Router
 *
 * Classifies context sensitivity and decides which provider tier is
 * appropriate.  Used to warn or block when sensitive data would be sent
 * to an external cloud provider against org routing policy.
 */
import logger from "../../utils/logger.js";

type ProviderTier = "local" | "external" | "any";

export interface RoutingDecision {
  tier: ProviderTier;
  reason: string;
  requiresScrubbing: boolean;
  sensitiveComponentCount: number;
}

const SENSITIVE_CLASSIFICATIONS = [
  "credentials",
  "pii",
  "phi",
  "pci",
  "secret",
];

/** Returns true for cloud providers that send data off-premises. */
function isExternalProvider(provider: string): boolean {
  return ["claude", "openai", "gemini", "vertexai"].includes(provider);
}

/** Returns true for local providers that keep data on-premises. */
/**
 * Classify the sensitivity of a threat model context and return a routing decision.
 * Components may carry `dataClassification` inside their `properties` JSON blob.
 */
export function classifyContextSensitivity(context: {
  components: Array<{ properties?: Record<string, unknown> | null }>;
  hasDocumentContent?: boolean;
  documentScrubCount?: number;
}): RoutingDecision {
  const sensitiveComponents = context.components.filter((c) => {
    const classification = c.properties?.dataClassification;
    if (!classification) return false;
    const labels: string[] = Array.isArray(classification)
      ? (classification as string[])
      : typeof classification === "string"
        ? [classification]
        : [];
    return labels.some((l) =>
      SENSITIVE_CLASSIFICATIONS.includes(l.toLowerCase()),
    );
  });

  if (sensitiveComponents.length > 0) {
    return {
      tier: "local",
      reason: `${sensitiveComponents.length} component(s) classified as sensitive`,
      requiresScrubbing: false,
      sensitiveComponentCount: sensitiveComponents.length,
    };
  }

  if (context.documentScrubCount && context.documentScrubCount > 0) {
    return {
      tier: "any",
      reason: `Document contained ${context.documentScrubCount} scrubbed sensitive patterns`,
      requiresScrubbing: true,
      sensitiveComponentCount: 0,
    };
  }

  return {
    tier: "any",
    reason: "No sensitive data detected",
    requiresScrubbing: false,
    sensitiveComponentCount: 0,
  };
}

export type AIRoutingPolicy = "allow-cloud" | "local-only" | "prefer-local";

/**
 * Check whether an AI call is permitted under the org's routing policy.
 * Logs a warning (or throws, if policy is local-only) when an external
 * provider would receive sensitive data.
 *
 * @returns true if the call should proceed, false if it should be blocked.
 */
export function enforceRoutingPolicy(
  provider: string,
  decision: RoutingDecision,
  policy: AIRoutingPolicy,
  context: { organizationId?: string; jobType?: string },
): boolean {
  if (!isExternalProvider(provider)) {
    // Local provider — always allowed
    return true;
  }

  // External provider path
  if (policy === "local-only") {
    logger.warn(
      { ...context, provider, reason: decision.reason },
      "Routing policy violation: org is local-only but external provider requested — blocking job",
    );
    return false;
  }

  if (decision.tier === "local" && policy !== "allow-cloud") {
    logger.warn(
      { ...context, provider, reason: decision.reason, policy },
      "Sensitive context routed to external provider (prefer-local policy active)",
    );
    // prefer-local: warn but allow
    return true;
  }

  if (decision.tier === "local" && policy === "allow-cloud") {
    logger.warn(
      { ...context, provider, reason: decision.reason },
      "Sensitive context routed to external provider (allow-cloud policy active)",
    );
    return true;
  }

  return true;
}
