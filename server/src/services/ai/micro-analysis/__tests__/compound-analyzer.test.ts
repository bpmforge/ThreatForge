/**
 * Compound-analyzer mitigation shape.
 *
 * The compound-threat prompt schema historically asked the model for a
 * singular "mitigation" object, but the parser only ever read the plural
 * `t.mitigations` array — so real mitigation text from the model was
 * discarded and every compound threat shipped the hardcoded placeholder
 * "Break the attack chain". Fix: accept both the singular string/object and
 * the plural array, normalise into mitigations[], and when neither is
 * present emit an empty array rather than placeholder text.
 */
import { describe, it, expect, vi } from "vitest";
import { analyzeCompoundThreats } from "../compound-analyzer.js";
import type { MicroThreat } from "../types.js";

const components = [
  { id: "c1", name: "Web App", type: "SERVICE" },
  { id: "c2", name: "Database", type: "DATABASE" },
];
const connections = [{ source: "c1", target: "c2" }];

function perComponentThreats(): MicroThreat[] {
  return Array.from({ length: 3 }, (_, i) => ({
    name: `Threat ${i}`,
    description: "desc",
    category: "TAMPERING",
    severity: "HIGH",
    componentId: "c1",
    componentName: "Web App",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "MEDIUM", effectiveness: "0.3" },
    confidence: 0.7,
    sourceMethodology: "micro",
  }));
}

describe("analyzeCompoundThreats — mitigation normalisation", () => {
  it("uses the singular mitigation object when mitigations[] is absent", async () => {
    const aiCall = vi.fn().mockResolvedValue(
      JSON.stringify([
        {
          name: "Chained privilege escalation",
          description: "A -> B chain",
          category: "ELEVATION_OF_PRIVILEGE",
          severity: "CRITICAL",
          evidence: { attackPath: "c1 -> c2" },
          mitigation: {
            description: "Segment the network between app and database",
            effort: "MEDIUM",
            effectiveness: "0.5",
          },
          confidence: 0.8,
        },
      ]),
    );

    const { compoundThreats } = await analyzeCompoundThreats(
      aiCall,
      components,
      connections,
      perComponentThreats(),
    );

    expect(compoundThreats).toHaveLength(1);
    expect(compoundThreats[0].mitigations).toHaveLength(1);
    expect(compoundThreats[0].mitigations[0].description).toBe(
      "Segment the network between app and database",
    );
    expect(compoundThreats[0].mitigations[0].description).not.toBe(
      "Break the attack chain",
    );
  });

  it("accepts a raw string for the singular mitigation field", async () => {
    const aiCall = vi.fn().mockResolvedValue(
      JSON.stringify([
        {
          name: "Chained data exfiltration",
          description: "A -> B chain",
          category: "INFORMATION_DISCLOSURE",
          severity: "HIGH",
          evidence: { attackPath: "c1 -> c2" },
          mitigation: "Encrypt data in transit between components",
          confidence: 0.75,
        },
      ]),
    );

    const { compoundThreats } = await analyzeCompoundThreats(
      aiCall,
      components,
      connections,
      perComponentThreats(),
    );

    expect(compoundThreats).toHaveLength(1);
    expect(compoundThreats[0].mitigations[0].description).toBe(
      "Encrypt data in transit between components",
    );
  });

  it("uses the plural mitigations[] array when present", async () => {
    const aiCall = vi.fn().mockResolvedValue(
      JSON.stringify([
        {
          name: "Chained lateral movement",
          description: "A -> B -> C chain",
          category: "ELEVATION_OF_PRIVILEGE",
          severity: "CRITICAL",
          evidence: { attackPath: "c1 -> c2" },
          mitigations: [
            {
              description: "Add mTLS between services",
              controlCategory: "ACCESS_CONTROL",
              effort: "HIGH",
              effectiveness: "0.6",
            },
            {
              description: "Add anomaly detection on the DB tier",
              controlCategory: "DETECTION",
              effort: "MEDIUM",
              effectiveness: "0.4",
            },
          ],
          confidence: 0.8,
        },
      ]),
    );

    const { compoundThreats } = await analyzeCompoundThreats(
      aiCall,
      components,
      connections,
      perComponentThreats(),
    );

    expect(compoundThreats).toHaveLength(1);
    expect(compoundThreats[0].mitigations).toHaveLength(2);
    expect(compoundThreats[0].mitigations.map((m) => m.description)).toEqual([
      "Add mTLS between services",
      "Add anomaly detection on the DB tier",
    ]);
  });

  it("emits no mitigation (empty array) when neither singular nor plural is present", async () => {
    const aiCall = vi.fn().mockResolvedValue(
      JSON.stringify([
        {
          name: "Chained threat with no mitigation offered",
          description: "A -> B chain",
          category: "ELEVATION_OF_PRIVILEGE",
          severity: "HIGH",
          evidence: { attackPath: "c1 -> c2" },
          confidence: 0.7,
        },
      ]),
    );

    const { compoundThreats } = await analyzeCompoundThreats(
      aiCall,
      components,
      connections,
      perComponentThreats(),
    );

    expect(compoundThreats).toHaveLength(1);
    expect(compoundThreats[0].mitigations).toEqual([]);
    expect(
      compoundThreats.some((t) =>
        t.mitigations.some((m) => m.description === "Break the attack chain"),
      ),
    ).toBe(false);
    expect(compoundThreats[0].mitigation.description).not.toBe(
      "Break the attack chain",
    );
  });
});
