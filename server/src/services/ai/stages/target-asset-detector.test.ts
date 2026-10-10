/**
 * TargetAssetDetector stage unit tests: attack-chain Pass 2.
 *
 * Proves: plausible target assets surface (the DATABASE etc.); a hallucinated id
 * is dropped + counted; the payload override path resolves ids from topology
 * WITHOUT an LLM call (Pass 2 skipped) and still drops hallucinated overrides.
 *
 * JOURNAL STATUS (flagged): see entry-point-detector.test.ts — Pass-1/2 prompts
 * are NOT in the committed go-forward llm-journal.json (LM Studio unreachable
 * from this isolated worktree). Uses a deterministic STUBBED aiCall.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ThreatModelContext } from "../../../types/ai.js";
import { registerStageHandlers } from "./index.js";
import { getStage, resetStageRegistry, type StageContext } from "./registry.js";
import { targetAssetDetectorStage } from "./target-asset-detector.js";

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

describe("TargetAssetDetector stage handler (pass 2)", () => {
  beforeEach(() => {
    resetStageRegistry();
  });

  it("registers via stages/index.ts side-effect registration", () => {
    expect(() => getStage("TargetAssetDetector")).toThrowError(
      /not registered/,
    );
    registerStageHandlers();
    expect(getStage("TargetAssetDetector")).toBe(targetAssetDetectorStage);
  });

  it("returns plausible target assets (the DATABASE) and drops a hallucinated id", async () => {
    const context = loadFixtureContext();
    const stubResponse = JSON.stringify([
      {
        componentId: "comp-postgres", // DATABASE — crown jewel
        justification: "Primary store of customer + payment data.",
        value: 1.0,
      },
      {
        componentId: "comp-auth-service",
        justification: "Issues credentials — privileged capability.",
        value: 0.8,
      },
      {
        componentId: "comp-ghost-vault", // hallucinated
        justification: "Imaginary secret store.",
        value: 0.9,
      },
    ]);

    let calls = 0;
    const result = await targetAssetDetectorStage(
      makeCtx({ context }, async () => {
        calls++;
        return stubResponse;
      }),
    );

    expect(calls).toBe(1);
    const assets = result.outputs.targetAssets as Array<{
      componentId: string;
      componentName: string;
    }>;
    const ids = assets.map((a) => a.componentId);
    expect(ids).toContain("comp-postgres");
    expect(ids).toContain("comp-auth-service");
    expect(ids).not.toContain("comp-ghost-vault");
    expect(assets).toHaveLength(2);
    expect(
      assets.find((a) => a.componentId === "comp-postgres")?.componentName,
    ).toBe("PostgreSQL Primary");

    expect(result.outputs.hallucinatedIds).toEqual(["comp-ghost-vault"]);
    expect(result.parseFailures).toHaveLength(1);
    expect(result.parseFailures[0].stage).toBe("attack-chain");
  });

  it("override path resolves ids from topology WITHOUT an LLM call (Pass 2 skipped)", async () => {
    const context = loadFixtureContext();
    let calls = 0;
    const result = await targetAssetDetectorStage(
      makeCtx(
        {
          context,
          targetAssetsOverride: ["comp-postgres", "comp-redis", "comp-bogus"],
        },
        async () => {
          calls++;
          throw new Error("LLM should not be called on the override path");
        },
      ),
    );

    expect(calls).toBe(0); // no network / LLM call
    const assets = result.outputs.targetAssets as Array<{
      componentId: string;
      componentName: string;
      justification: string;
    }>;
    expect(assets.map((a) => a.componentId)).toEqual([
      "comp-postgres",
      "comp-redis",
    ]);
    expect(assets[0].justification).toMatch(/override/i);
    // Hallucinated override still dropped + counted.
    expect(result.outputs.hallucinatedIds).toEqual(["comp-bogus"]);
    expect(result.parseFailures).toHaveLength(1);
  });

  it("throws without context", async () => {
    await expect(
      targetAssetDetectorStage(makeCtx({}, async () => "[]")),
    ).rejects.toThrow(/requires inputs.context/);
  });
});
