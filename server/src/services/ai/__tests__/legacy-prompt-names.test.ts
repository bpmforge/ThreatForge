/** The legacy prompt renders component names, never raw ids. */
import { describe, it, expect } from "vitest";
import { buildThreatAnalysisPrompt } from "../prompts/builders.js";
import { parseThreats } from "../agentic-analysis.js";

const context = {
  name: "Sys",
  components: [
    {
      id: "ckx9zq0001abcd",
      name: "API Gateway",
      type: "api",
      trustZone: "dmz",
    },
    { id: "ckx9zq0002efgh", name: "Database", type: "datastore" },
  ],
  connections: [],
  boundaries: [],
} as unknown as Parameters<typeof buildThreatAnalysisPrompt>[0];

describe("buildThreatAnalysisPrompt", () => {
  const prompt = buildThreatAnalysisPrompt(context);

  it("shows names and no raw ids", () => {
    expect(prompt).toContain("**API Gateway**");
    expect(prompt).not.toContain("ckx9zq0001abcd");
    expect(prompt).not.toContain("[ID:");
  });

  it("asks for targetComponent by name", () => {
    expect(prompt).toContain('"targetComponent"');
    expect(prompt).not.toContain('"targetComponentId"');
  });
});

describe("parseThreats name resolution", () => {
  it("maps targetComponent name to the component id", () => {
    const raw = JSON.stringify([
      { title: "t", targetComponent: "database" },
      { title: "u", targetComponent: "Unknown" },
    ]);
    const out = parseThreats(raw, "stride", context.components);
    expect(out[0].targetComponentId).toBe("ckx9zq0002efgh");
    expect(out[1].targetComponentId).toBeNull();
  });
});
