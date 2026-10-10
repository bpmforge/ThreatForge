/**
 * Golden-run parity comparator.
 *
 * Compares two threat sets produced by pipeline runs (legacy micro vs
 * unified, or run vs committed golden snapshot):
 *
 * - Threats are normalized to the ADR-006 key
 *   `${targetKey}::${category}::${normalizedName}` and compared as SETS —
 *   order is never compared (fan-out is nondeterministic).
 * - The paraphrase-resistant `normalizeThreatName` from
 *   services/threat-review is REUSED, not re-implemented, so a renamed but
 *   paraphrase-equal threat maps to the same key.
 * - For intersecting keys: severity must be within ±1 ordinal step on the
 *   canonical Prisma `Severity` ordering (INFO < LOW < MEDIUM < HIGH <
 *   CRITICAL) and mitigation count within ±1.
 * - `pass` = both `onlyIn*` empty AND total drift entries (severity +
 *   mitigation) ≤ 10% of the intersection size.
 */
import { normalizeThreatName } from "../../services/threat-review/normalize-threat-name.js";

/**
 * Minimal structural shape of a threat for parity comparison. The micro
 * pipeline's `MicroThreat` satisfies this directly; golden-snapshot entries
 * supply `mitigationCount` instead of a mitigations array.
 */
export interface ThreatLike {
  name: string;
  category: string;
  /** Canonical Prisma Severity value (micro pipeline emits LOW..CRITICAL). */
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** React Flow nodeId ("compound" for compound threats; falsy → sentinel). */
  componentId?: string | null;
  /** Connection-attached threats (DB-shaped inputs). */
  connectionEdgeId?: string | null;
  mitigations?: ReadonlyArray<unknown>;
  /** Pre-computed count for snapshot-shaped inputs; wins over mitigations. */
  mitigationCount?: number;
}

export interface DriftEntry {
  key: string;
  a: string | number;
  b: string | number;
}

export interface ParityReport {
  onlyInA: string[];
  onlyInB: string[];
  severityDrift: DriftEntry[];
  mitigationDrift: DriftEntry[];
  intersectionSize: number;
  pass: boolean;
}

/** Canonical severity ordering (Prisma enum Severity, ascending). */
const SEVERITY_ORDER = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function severityOrdinal(severity: string): number {
  const idx = SEVERITY_ORDER.indexOf(
    severity as (typeof SEVERITY_ORDER)[number],
  );
  if (idx === -1) {
    throw new Error(
      `Unknown severity "${severity}" — expected one of ${SEVERITY_ORDER.join(", ")}`,
    );
  }
  return idx;
}

/**
 * Build the ADR-006 parity key for a threat. Target resolution mirrors
 * `buildThreatDedupKey` / `persistAIThreats`: component, else connection,
 * else the `__compound__` sentinel.
 */
export function parityKey(t: ThreatLike): string {
  const targetKey = t.componentId || t.connectionEdgeId || "__compound__";
  return `${targetKey}::${t.category}::${normalizeThreatName(t.name)}`;
}

function mitigationCountOf(t: ThreatLike): number {
  return t.mitigationCount ?? t.mitigations?.length ?? 0;
}

/** First occurrence wins on duplicate keys (ADR-006 dedup makes dupes rare). */
function toKeyMap(threats: ThreatLike[]): Map<string, ThreatLike> {
  const map = new Map<string, ThreatLike>();
  for (const t of threats) {
    const key = parityKey(t);
    if (!map.has(key)) map.set(key, t);
  }
  return map;
}

/**
 * Compare two threat sets against the parity gate. Pure set semantics —
 * input order never affects the result.
 */
export function compareThreatSets(
  a: ThreatLike[],
  b: ThreatLike[],
): ParityReport {
  const mapA = toKeyMap(a);
  const mapB = toKeyMap(b);

  const onlyInA = [...mapA.keys()].filter((k) => !mapB.has(k)).sort();
  const onlyInB = [...mapB.keys()].filter((k) => !mapA.has(k)).sort();

  const severityDrift: DriftEntry[] = [];
  const mitigationDrift: DriftEntry[] = [];
  let intersectionSize = 0;

  for (const [key, threatA] of mapA) {
    const threatB = mapB.get(key);
    if (!threatB) continue;
    intersectionSize++;

    const sevA = severityOrdinal(threatA.severity);
    const sevB = severityOrdinal(threatB.severity);
    if (Math.abs(sevA - sevB) > 1) {
      severityDrift.push({ key, a: threatA.severity, b: threatB.severity });
    }

    const mitA = mitigationCountOf(threatA);
    const mitB = mitigationCountOf(threatB);
    if (Math.abs(mitA - mitB) > 1) {
      mitigationDrift.push({ key, a: mitA, b: mitB });
    }
  }

  severityDrift.sort((x, y) => x.key.localeCompare(y.key));
  mitigationDrift.sort((x, y) => x.key.localeCompare(y.key));

  const driftCount = severityDrift.length + mitigationDrift.length;
  const pass =
    onlyInA.length === 0 &&
    onlyInB.length === 0 &&
    driftCount <= 0.1 * intersectionSize;

  return {
    onlyInA,
    onlyInB,
    severityDrift,
    mitigationDrift,
    intersectionSize,
    pass,
  };
}

/** Render a ParityReport as a readable fixed-width table for CLI output. */
export function formatParityReport(report: ParityReport): string {
  const lines: string[] = [];
  const row = (label: string, value: string) =>
    lines.push(`| ${label.padEnd(22)} | ${value.padEnd(48)} |`);
  const rule = "+" + "-".repeat(24) + "+" + "-".repeat(50) + "+";

  lines.push(rule);
  row("Parity check", report.pass ? "PASS" : "FAIL");
  row("Intersection", String(report.intersectionSize));
  row("Only in A", String(report.onlyInA.length));
  row("Only in B", String(report.onlyInB.length));
  row("Severity drift (>±1)", String(report.severityDrift.length));
  row("Mitigation drift (>±1)", String(report.mitigationDrift.length));
  lines.push(rule);

  for (const key of report.onlyInA) lines.push(`  ONLY IN A: ${key}`);
  for (const key of report.onlyInB) lines.push(`  ONLY IN B: ${key}`);
  for (const d of report.severityDrift) {
    lines.push(`  SEVERITY DRIFT: ${d.key} (a=${d.a}, b=${d.b})`);
  }
  for (const d of report.mitigationDrift) {
    lines.push(`  MITIGATION DRIFT: ${d.key} (a=${d.a}, b=${d.b})`);
  }
  return lines.join("\n");
}
