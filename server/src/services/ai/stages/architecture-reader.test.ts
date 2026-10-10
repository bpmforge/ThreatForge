/**
 * ArchitectureReader stage handler unit tests. DB-free: context is
 * provided via inputs (the fixture/e2e path) so the handler never touches
 * Prisma — DB assembly via buildThreatModelContext is exercised elsewhere.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { ThreatModelContext } from "../../../types/ai.js";
import { architectureReaderStage } from "./architecture-reader.js";
import { registerStageHandlers } from "./index.js";
import { getStage, resetStageRegistry, type StageContext } from "./registry.js";

const context: ThreatModelContext = {
  name: "Unit fixture",
  methodology: "STRIDE",
  components: [
    { id: "web", name: "Web App", type: "WEB_APP", trustZone: "INTERNAL" },
    { id: "db", name: "Primary DB", type: "DATABASE", trustZone: "INTERNAL" },
  ],
  connections: [
    {
      id: "c1",
      source: "web",
      target: "db",
      protocol: "POSTGRESQL",
      encrypted: true,
    },
  ],
  boundaries: [],
  sequenceFlows: [
    {
      diagramName: "Login",
      messages: [{ from: "Web App", to: "Primary DB", label: "query user" }],
    },
  ],
};

function makeCtx(overrides: Partial<StageContext> = {}): StageContext {
  return {
    executionId: "exec-1",
    threatModelId: "",
    organizationId: "org-1",
    sessionId: "session-1",
    inputs: { context },
    aiCall: async () => "[]",
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe("ArchitectureReader stage handler", () => {
  beforeEach(() => {
    resetStageRegistry();
  });

  it("registers via stages/index.ts side-effect registration", () => {
    expect(() => getStage("ArchitectureReader")).toThrowError(/not registered/);
    registerStageHandlers();
    expect(getStage("ArchitectureReader")).toBe(architectureReaderStage);
  });

  it("assembles componentContexts, sequence flows, and methodology", async () => {
    const result = await architectureReaderStage(makeCtx());

    const componentContexts = result.outputs.componentContexts as Array<{
      id: string;
      name: string;
      inbound: unknown[];
      outbound: unknown[];
    }>;
    expect(componentContexts.map((c) => c.id)).toEqual(["web", "db"]);
    // toComponentContext resolved the connection into inbound/outbound edges
    expect(componentContexts[0].outbound).toHaveLength(1);
    expect(componentContexts[1].inbound).toHaveLength(1);

    // Sequence flows mapped per component by name match, JSON-safe record
    const flows = result.outputs.sequenceFlows as Record<string, unknown[]>;
    expect(Object.keys(flows).sort()).toEqual(["db", "web"]);
    expect(flows.web).toHaveLength(1);

    expect(result.outputs.methodology).toBe("STRIDE");
    expect(result.outputs.skipSet).toEqual([]); // no persist → no DB skip-set
    expect(result.outputs.context).toBe(context); // assembled context rides along
    expect(result.outputs.requirements).toEqual([]);
    expect(result.outputs.parseFailures).toEqual([]);
    expect(result.tokensUsed).toBe(0);
  });

  it("normalizes methodology labels for stage conditions", async () => {
    const result = await architectureReaderStage(
      makeCtx({
        inputs: { context: { ...context, methodology: "kill chain" } },
      }),
    );
    expect(result.outputs.methodology).toBe("KILL_CHAIN");
  });

  it("reports completion via ctx.progress", async () => {
    const calls: Array<{ pct: number; msg: string }> = [];
    await architectureReaderStage(
      makeCtx({
        progress: async (pct, msg) => {
          calls.push({ pct, msg });
        },
      }),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].pct).toBe(100);
    expect(calls[0].msg).toContain("2 components");
  });

  it("throws without inputs.context and without ctx.threatModelId", async () => {
    await expect(
      architectureReaderStage(makeCtx({ inputs: {} })),
    ).rejects.toThrowError(/requires inputs\.context or ctx\.threatModelId/);
  });
});
