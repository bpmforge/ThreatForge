/**
 * EntryPointDetector stage unit tests — attack-chain Pass 1.
 *
 * Builds a ThreatModelContext from the go-forward fixture and proves:
 *  - plausible entry points surface (the EXTERNAL_ENTITY + public WEB_APP),
 *  - a hallucinated component id in the LLM output is DROPPED and counted as a
 *    parseFailure (never returned as an entry point),
 *  - registration via stages/index.ts side-effect.
 *
 * The committed llm-journal.json has no Pass-1/Pass-2 prompt entries, so this
 * test uses a deterministic stubbed aiCall instead of createReplayAICaller.
 * Once those prompts are recorded in the journal it can switch to replay mode.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ThreatModelContext } from "../../../types/ai.js";
import { registerStageHandlers } from "./index.js";
import { getStage, resetStageRegistry, type StageContext } from "./registry.js";
import { entryPointDetectorStage } from "./entry-point-detector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface FixtureNode {
  id: string;
  type: string;
  data?: { label?: string; componentType?: string; trustZone?: string };
}
interface FixtureEdge {
  id: string;
  source: string;
  target: string;
  data?: { protocol?: string; encrypted?: boolean };
}

/** Build a ThreatModelContext from the fixture (no DB — pure topology). */
function loadFixtureContext(): ThreatModelContext {
  const fixture = JSON.parse(
    readFileSync(
      join(__dirname, "../../../test/fixtures/go-forward/fixture-model.json"),
      "utf8",
    ),
  ) as {
    name: string;
    methodology?: string;
    canvasState: { nodes: FixtureNode[]; edges: FixtureEdge[] };
  };
  const components = fixture.canvasState.nodes
    .filter((n) => n.type === "component")
    .map((n) => ({
      id: n.id,
      name: n.data?.label ?? n.id,
      type: n.data?.componentType ?? "UNKNOWN",
      trustZone: n.data?.trustZone,
    }));
  const connections = fixture.canvasState.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    protocol: e.data?.protocol,
    encrypted: e.data?.encrypted,
  }));
  return {
    name: fixture.name,
    components,
    connections,
    boundaries: [],
    methodology: fixture.methodology,
  };
}

function makeCtx(
  inputs: Record<string, unknown>,
  aiCall: StageContext["aiCall"],
): StageContext {
  return {
    executionId: "exec-ac",
    threatModelId: "tm-ac",
    organizationId: "org-1",
    sessionId: "session-ac",
    inputs,
    aiCall,
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
  };
}

describe("EntryPointDetector stage handler (pass 1)", () => {
  beforeEach(() => {
    resetStageRegistry();
  });

  it("registers via stages/index.ts side-effect registration", () => {
    expect(() => getStage("EntryPointDetector")).toThrowError(/not registered/);
    registerStageHandlers();
    expect(getStage("EntryPointDetector")).toBe(entryPointDetectorStage);
  });

  it("returns plausible entry points (external entity + public web app) and drops a hallucinated id", async () => {
    const context = loadFixtureContext();

    // Stubbed LLM: two real external-facing components + one hallucinated id.
    const stubResponse = JSON.stringify([
      {
        componentId: "comp-payment-gateway", // EXTERNAL_ENTITY
        justification: "External payment provider connecting inward.",
        exposure: 0.8,
      },
      {
        componentId: "comp-web-portal", // public WEB_APP (DMZ)
        justification: "Internet-facing customer web portal.",
        exposure: 0.95,
      },
      {
        componentId: "comp-DOES-NOT-EXIST", // hallucinated — must be dropped
        justification: "Imaginary edge gateway.",
        exposure: 0.5,
      },
    ]);

    let calls = 0;
    const result = await entryPointDetectorStage(
      makeCtx({ context }, async () => {
        calls++;
        return stubResponse;
      }),
    );

    expect(calls).toBe(1);
    const entryPoints = result.outputs.entryPoints as Array<{
      componentId: string;
      componentName: string;
    }>;
    const ids = entryPoints.map((e) => e.componentId);
    expect(ids).toContain("comp-payment-gateway");
    expect(ids).toContain("comp-web-portal");
    expect(ids).not.toContain("comp-DOES-NOT-EXIST");
    expect(entryPoints).toHaveLength(2);

    // Component names resolved from topology.
    expect(
      entryPoints.find((e) => e.componentId === "comp-web-portal")
        ?.componentName,
    ).toBe("Customer Web Portal");

    // Hallucinated id dropped AND counted as a parseFailure.
    expect(result.outputs.hallucinatedIds).toEqual(["comp-DOES-NOT-EXIST"]);
    expect(result.parseFailures).toHaveLength(1);
    expect(result.parseFailures[0].stage).toBe("attack-chain");
    expect(result.parseFailures[0].error).toMatch(/Hallucinated/);
  });

  it("schema-invalid rows are dropped as parseFailures too", async () => {
    const context = loadFixtureContext();
    const result = await entryPointDetectorStage(
      makeCtx({ context }, async () =>
        JSON.stringify([
          { componentId: "comp-web-portal", justification: "ok" },
          { componentId: "", justification: "empty id is invalid" },
          { justification: "missing componentId" },
        ]),
      ),
    );
    expect(result.outputs.entryPoints).toHaveLength(1);
    expect(result.parseFailures.length).toBe(2);
  });

  it("throws without context", async () => {
    await expect(
      entryPointDetectorStage(makeCtx({}, async () => "[]")),
    ).rejects.toThrow(/requires inputs.context/);
  });
});
