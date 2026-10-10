import { parse } from "yaml";

export const SEVERITIES = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFORMATIONAL",
] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Threat statuses that count as resolved (no open exposure). */
const RESOLVED_THREAT = new Set([
  "MITIGATED",
  "ACCEPTED",
  "ACCEPTED_RISK",
  "NOT_APPLICABLE",
  "FALSE_POSITIVE",
]);
const THREAT_STATUSES = new Set(["OPEN", "IN_PROGRESS", ...RESOLVED_THREAT]);
const MITIGATION_STATUSES = new Set(["NOT_IMPLEMENTED", "IMPLEMENTED"]);

export interface NormThreat {
  id?: string;
  name: string;
  severity: Severity;
  status: string;
  mitigations: { status: string }[];
}

export interface NormModel {
  name: string;
  components: number;
  connections: number;
  threats: NormThreat[];
}

export class ModelError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join("; "));
  }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) =>
  typeof v === "string" ? v : v == null ? undefined : String(v);

/**
 * Parse + validate a ThreatForge YAML model. Accepts both export dialects:
 *  - "threat model as code" (frontend): model.name, threats[].mitigations[]
 *  - server export: top-level name, flat mitigations[] keyed by threat name
 * Throws ModelError listing every schema problem.
 */
export function parseModel(text: string): NormModel {
  let doc: unknown;
  try {
    doc = parse(text);
  } catch (e) {
    throw new ModelError([
      `YAML parse error: ${(e as Error).message.split("\n")[0]}`,
    ]);
  }
  if (!isObj(doc)) throw new ModelError(["Document root must be a mapping"]);

  const problems: string[] = [];
  if (doc.version == null) problems.push("Missing required field: version");
  const name = isObj(doc.model) ? str(doc.model.name) : str(doc.name);
  if (!name) problems.push("Missing required field: model.name (or name)");

  const list = (key: string): unknown[] => {
    const v = doc[key];
    if (v == null) return [];
    if (!Array.isArray(v)) {
      problems.push(`${key}: must be a list`);
      return [];
    }
    return v;
  };

  const components = list("components");
  components.forEach((c, i) => {
    if (!isObj(c))
      return void problems.push(`components[${i}]: must be a mapping`);
    if (c.id == null) problems.push(`components[${i}]: missing id`);
    if (!c.name) problems.push(`components[${i}]: missing name`);
  });
  const connections = list("connections");

  // Flat (server) dialect: mitigations keyed by threat name.
  const flat = new Map<string, { status: string }[]>();
  list("mitigations").forEach((m, i) => {
    if (!isObj(m))
      return void problems.push(`mitigations[${i}]: must be a mapping`);
    const status = str(m.status)?.toUpperCase() ?? "NOT_IMPLEMENTED";
    if (!MITIGATION_STATUSES.has(status))
      problems.push(`mitigations[${i}]: invalid status "${status}"`);
    const key = str(m.threat) ?? "";
    flat.set(key, [...(flat.get(key) ?? []), { status }]);
  });

  const threats: NormThreat[] = [];
  list("threats").forEach((t, i) => {
    if (!isObj(t))
      return void problems.push(`threats[${i}]: must be a mapping`);
    const tname = str(t.name);
    const label = `threats[${i}]${tname ? ` (${tname})` : ""}`;
    if (!tname) problems.push(`${label}: missing name`);
    const sev = str(t.severity)?.toUpperCase();
    if (!sev) problems.push(`${label}: missing severity`);
    else if (!(SEVERITIES as readonly string[]).includes(sev))
      problems.push(
        `${label}: invalid severity "${sev}" (valid: ${SEVERITIES.join(", ")})`,
      );
    const status = str(t.status)?.toUpperCase() ?? "OPEN";
    if (!THREAT_STATUSES.has(status))
      problems.push(`${label}: invalid status "${status}"`);

    const mits: { status: string }[] = [];
    if (t.mitigations != null && !Array.isArray(t.mitigations))
      problems.push(`${label}: mitigations must be a list`);
    for (const [j, m] of (Array.isArray(t.mitigations)
      ? t.mitigations
      : []
    ).entries()) {
      const ms = isObj(m)
        ? (str(m.status)?.toUpperCase() ?? "NOT_IMPLEMENTED")
        : "";
      if (!MITIGATION_STATUSES.has(ms))
        problems.push(`${label}.mitigations[${j}]: invalid status "${ms}"`);
      else mits.push({ status: ms });
    }
    mits.push(...(tname ? (flat.get(tname) ?? []) : []));
    threats.push({
      id: str(t.id),
      name: tname ?? "",
      severity: (sev ?? "MEDIUM") as Severity,
      status,
      mitigations: mits,
    });
  });

  if (problems.length) throw new ModelError(problems);
  return {
    name: name!,
    components: components.length,
    connections: connections.length,
    threats,
  };
}

/** A threat is mitigated if resolved by status or has an IMPLEMENTED mitigation. */
export function isMitigated(t: NormThreat): boolean {
  return (
    RESOLVED_THREAT.has(t.status) ||
    t.mitigations.some((m) => m.status === "IMPLEMENTED")
  );
}
