/**
 * Attack Chain Analysis — Prompt builders
 *
 * Isolated to keep attack-chain-service.ts under 200 lines.
 */
import type { ThreatModelContext } from "../../types/ai.js";

/** Component types that are external-facing entry points */
const ENTRY_TYPES = new Set([
  "ACTOR",
  "EXTERNAL_ENTITY",
  "WEB_APP",
  "MOBILE_APP",
  "API",
  "API_GATEWAY",
]);

/** Component types that are high-value target assets */
const TARGET_TYPES = new Set([
  "DATABASE",
  "DATA_STORE",
  "SECRET_VAULT",
  "PAYMENT_SERVICE",
]);

/** Summarise components as a compact JSON string for prompts */
function summariseComponents(context: ThreatModelContext): string {
  return JSON.stringify(
    context.components.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
    })),
  );
}

/** Summarise connections for path-generation prompts */
function summariseConnections(context: ThreatModelContext): string {
  return JSON.stringify(
    context.connections.map((c) => ({
      from: c.source,
      to: c.target,
      label: c.label,
    })),
  );
}

export function entryPointPrompt(context: ThreatModelContext): string {
  const types = [...ENTRY_TYPES].join(", ");
  return `You are a security architect analyzing a threat model.

Components:
${summariseComponents(context)}

Identify all external-facing entry points. Entry point types include: ${types}.
Return ONLY a JSON array (no markdown): [{"id":"...","name":"...","reason":"..."}]`;
}

export function targetAssetPrompt(context: ThreatModelContext): string {
  const types = [...TARGET_TYPES].join(", ");
  return `You are a security architect analyzing a threat model.

Components:
${summariseComponents(context)}

Identify all high-value target assets. Target types include: ${types}.
Return ONLY a JSON array (no markdown): [{"id":"...","name":"...","value":"..."}]`;
}

export function pathGenerationPrompt(
  context: ThreatModelContext,
  entryId: string,
  entryName: string,
  targetId: string,
  targetName: string,
): string {
  return `You are a security architect generating realistic attack chains.

Components:
${summariseComponents(context)}

Connections (from→to):
${summariseConnections(context)}

Generate an attack chain from entry point "${entryName}" (id: ${entryId}) to target asset "${targetName}" (id: ${targetId}).
The chain must follow actual component connections listed above.

Return ONLY a JSON object (no markdown):
{
  "name": "short descriptive name",
  "description": "1-2 sentence description",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "hops": [
    {"position":1,"componentId":"...","componentName":"...","description":"attacker action","technique":"optional MITRE technique"}
  ]
}

Max 8 hops. Each hop must reference a real component id from the list above.`;
}

export function validationPrompt(
  context: ThreatModelContext,
  chains: unknown[],
): string {
  return `You are a security architect validating attack chains.

Valid connections in the diagram (from→to):
${summariseConnections(context)}

Chains to validate:
${JSON.stringify(chains)}

Remove chains where hops do not follow actual component connections.
Return ONLY a JSON array of the valid chains (no markdown). Keep chain objects exactly as-is, just omit invalid ones.`;
}
