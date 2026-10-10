/**
 * Cross-Portfolio Systemic Patterns
 *
 * Finds threats that recur across many threat models in an organization —
 * the "same problem, different system" view a CISO needs. Companion to
 * model-comparison.ts, which ranks models; this ranks recurring problems.
 *
 * A threat is grouped along three independent dimensions, so one threat can
 * contribute to up to three patterns (name, category, and each CWE it cites):
 *   - name:     normalized threat title
 *   - category: normalized threat category
 *   - cwe:      each CWE id on the threat
 */
import { getPrisma } from "../../db.js";

type PatternKind = "name" | "category" | "cwe";

export interface PatternThreatInput {
  name: string;
  category: string | null;
  severity: string;
  status: string;
  cweIds: string | null;
}

export interface PatternModelInput {
  id: string;
  name: string;
  projectName: string;
  threats: PatternThreatInput[];
}

export interface SystemicPattern {
  kind: PatternKind;
  key: string;
  label: string;
  modelCount: number;
  threatCount: number;
  unmitigatedCount: number;
  severityMix: Record<string, number>;
  /** Highest severity seen across the pattern's threats. */
  maxSeverity: string;
  affectedModels: Array<{
    id: string;
    name: string;
    projectName: string;
    threatCount: number;
    unmitigatedCount: number;
  }>;
}

export interface SystemicPatternsResult {
  organizationId: string;
  minModels: number;
  totalModels: number;
  patterns: SystemicPattern[];
}

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

export function normalizePatternKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCweIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string | number =>
        ["string", "number"].includes(typeof v),
      )
      .map((v) => String(v).trim().toUpperCase())
      .map((v) => (/^\d+$/.test(v) ? `CWE-${v}` : v))
      .filter(Boolean);
  } catch {
    return [];
  }
}

interface Bucket {
  kind: PatternKind;
  key: string;
  label: string;
  models: Map<string, SystemicPattern["affectedModels"][number]>;
  threatCount: number;
  unmitigatedCount: number;
  severityMix: Record<string, number>;
}

/**
 * Pure aggregation: group threats across models into recurring patterns that
 * appear in at least `minModels` distinct models.
 */
export function aggregateSystemicPatterns(
  models: PatternModelInput[],
  minModels: number,
): SystemicPattern[] {
  const buckets = new Map<string, Bucket>();

  for (const model of models) {
    for (const threat of model.threats) {
      const keys: Array<{ kind: PatternKind; key: string; label: string }> = [];

      const nameKey = normalizePatternKey(threat.name);
      if (nameKey)
        keys.push({ kind: "name", key: nameKey, label: threat.name });

      if (threat.category) {
        const categoryKey = normalizePatternKey(threat.category);
        if (categoryKey) {
          keys.push({
            kind: "category",
            key: categoryKey,
            label: threat.category,
          });
        }
      }

      for (const cwe of new Set(parseCweIds(threat.cweIds))) {
        keys.push({ kind: "cwe", key: cwe.toLowerCase(), label: cwe });
      }

      const unmitigated = threat.status === "OPEN";

      for (const { kind, key, label } of keys) {
        const bucketId = `${kind}:${key}`;
        let bucket = buckets.get(bucketId);
        if (!bucket) {
          bucket = {
            kind,
            key,
            label,
            models: new Map(),
            threatCount: 0,
            unmitigatedCount: 0,
            severityMix: {},
          };
          buckets.set(bucketId, bucket);
        }
        bucket.threatCount++;
        if (unmitigated) bucket.unmitigatedCount++;
        bucket.severityMix[threat.severity] =
          (bucket.severityMix[threat.severity] ?? 0) + 1;

        const entry = bucket.models.get(model.id) ?? {
          id: model.id,
          name: model.name,
          projectName: model.projectName,
          threatCount: 0,
          unmitigatedCount: 0,
        };
        entry.threatCount++;
        if (unmitigated) entry.unmitigatedCount++;
        bucket.models.set(model.id, entry);
      }
    }
  }

  const rank = (s: string) => {
    const i = SEVERITY_ORDER.indexOf(s);
    return i === -1 ? SEVERITY_ORDER.length : i;
  };

  return [...buckets.values()]
    .filter((b) => b.models.size >= minModels)
    .map((b) => ({
      kind: b.kind,
      key: b.key,
      label: b.label,
      modelCount: b.models.size,
      threatCount: b.threatCount,
      unmitigatedCount: b.unmitigatedCount,
      severityMix: b.severityMix,
      maxSeverity:
        Object.keys(b.severityMix).sort((a, c) => rank(a) - rank(c))[0] ??
        "INFO",
      affectedModels: [...b.models.values()].sort(
        (a, c) => c.unmitigatedCount - a.unmitigatedCount,
      ),
    }))
    .sort(
      (a, b) =>
        b.modelCount - a.modelCount ||
        b.unmitigatedCount - a.unmitigatedCount ||
        rank(a.maxSeverity) - rank(b.maxSeverity) ||
        a.label.localeCompare(b.label),
    );
}

/**
 * Systemic patterns across all live threat models in one organization.
 * Callers are responsible for authorizing access to `organizationId`.
 */
export async function getSystemicPatterns(
  organizationId: string,
  minModels = 2,
): Promise<SystemicPatternsResult> {
  const prisma = await getPrisma();

  const models = await prisma.threatModel.findMany({
    where: { project: { organizationId }, deletedAt: null },
    select: {
      id: true,
      name: true,
      project: { select: { name: true } },
      threats: {
        select: {
          name: true,
          category: true,
          severity: true,
          status: true,
          cweIds: true,
        },
      },
    },
  });

  const inputs: PatternModelInput[] = models.map((m) => ({
    id: m.id,
    name: m.name,
    projectName: m.project.name,
    threats: m.threats,
  }));

  return {
    organizationId,
    minModels,
    totalModels: inputs.length,
    patterns: aggregateSystemicPatterns(inputs, minModels),
  };
}
