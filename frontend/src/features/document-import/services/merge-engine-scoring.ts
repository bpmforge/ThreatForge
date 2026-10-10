import type { ExtractedComponent, GeneratedNode } from "./merge-engine-types";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameMatchScore(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const wordsA = new Set(na.split(" "));
  const wordsB = new Set(nb.split(" "));
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  const jaccard = intersection.length / union.size;
  if (jaccard >= 0.5) return 0.4 + jaccard * 0.4;

  return jaccard * 0.4;
}

function techMatchScore(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  const baseA = na.replace(/\s*\d+(\.\d+)*\s*$/g, "").trim();
  const baseB = nb.replace(/\s*\d+(\.\d+)*\s*$/g, "").trim();
  if (baseA === baseB && baseA.length > 0) return 0.9;
  if (baseA.includes(baseB) || baseB.includes(baseA)) return 0.7;
  return 0;
}

export function componentMatchScore(
  extracted: ExtractedComponent,
  existing: GeneratedNode,
): { score: number; reason: string } {
  if (existing.type === "boundary") return { score: 0, reason: "" };

  const nameSc = nameMatchScore(extracted.name, existing.data.label || "");
  const techSc = techMatchScore(extracted.technology, existing.data.technology);

  const typeMatch =
    extracted.type === existing.data.componentType ||
    normalize(extracted.type) === normalize(existing.data.componentType || "");
  const typeSc = typeMatch ? 0.3 : 0;

  const score = nameSc * 0.5 + techSc * 0.3 + typeSc * 0.2;

  let reason = "";
  if (score >= 0.6) {
    const parts: string[] = [];
    if (nameSc >= 0.7) parts.push(`name match (${Math.round(nameSc * 100)}%)`);
    if (techSc >= 0.7) parts.push(`technology match`);
    if (typeMatch) parts.push(`same type`);
    reason = parts.join(", ");
  }

  return { score, reason };
}
