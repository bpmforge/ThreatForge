/**
 * PathGenerator stage unit tests — attack-chain Pass 3.
 *
 * Builds a ThreatModelContext from the go-forward fixture and proves:
 *  - a candidate chain entry→target is produced from the (entry, target) pairs,
 *  - every hop's threatRef resolves (existing ref echoed; new-threat ref
 *    rewritten to the persisted `targetKey::normalizedName` handle),
 *  - a hop referencing a NEW threat is persisted AI_SUGGESTED via the normal
 *    dedup path EXACTLY ONCE across two runs (idempotency / dedup proof),
 *  - hops carry capability tokens (preconditions/yields),
 *  - a chain with a hallucinated hop componentId is DROPPED + counted,
 *  - registration via stages/index.ts side-effect.
 *
 * The committed llm-journal.json has no Pass-3 path-generation prompt entries,
 * so this test uses a deterministic stubbed aiCall rather than
 * createReplayAICaller (as the Pass 1/2 tests do). Once the Pass-3 prompts are
 * recorded, it can be switched to replay mode.
 *
 * Prisma is mocked (mirrors streaming-persist.test.ts) so the dedup proof runs
 * without a live DB: the mock simulates the unique-key behaviour of
 * persistAIThreats (first run creates, second run finds the existing PENDING
 * row and updates instead of creating a duplicate).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ThreatModelContext } from "../../../types/ai.js";
import { normalizeThreatName } from "../../threat-review/normalize-threat-name.js";
import type { StageContext } from "./registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Mock Prisma (drives persistAIThreats + the new-threat id resolution) ----
const mockThreatCreate = vi.fn();
const mockThreatUpdate = vi.fn();
const mockThreatFindMany = vi.fn();
const mockThreatFindFirst = vi.fn();
const mockComponentFindMany = vi.fn();
const mockMitigationDeleteMany = vi.fn();

const mockPrisma = {
  threatModel: { findUnique: vi.fn() },
  component: { findMany: mockComponentFindMany },
  threat: {
    findMany: mockThreatFindMany,
    findFirst: mockThreatFindFirst,
    update: mockThreatUpdate,
    create: mockThreatCreate,
  },
  mitigation: {
    create: vi.fn(),
    deleteMany: mockMitigationDeleteMany,
  },
  requirement: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "req-1" }),
  },
  mitigationRequirement: { create: vi.fn().mockResolvedValue({}) },
};

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Imported AFTER mocks so the mocked db is wired in.
const { pathGeneratorStage } = await import("./path-generator.js");
const { registerStageHandlers } = await import("./index.js");
const { getStage, resetStageRegistry } = await import("./registry.js");

interface FixtureNode {
  id: string;
  type: string;
  data?: { label?: string; type?: string; trustLevel?: string };
}

function loadFixtureContext(): ThreatModelContext {
  const fixture = JSON.parse(
    readFileSync(
      join(__dirname, "../../../test/fixtures/go-forward/fixture-model.json"),
      "utf8",
    ),
  ) as { name: string; canvasState: { nodes: FixtureNode[]; edges: never[] } };
  const components = fixture.canvasState.nodes
    .filter((n) => n.type === "component")
    .map((n) => ({
      id: n.id,
      name: n.data?.label ?? n.id,
      type: n.data?.type ?? "UNKNOWN",
      trustZone: n.data?.trustLevel,
    }));
  return {
    name: fixture.name,
    components,
    connections: [],
    boundaries: [],
  };
}

function makeCtx(
  inputs: Record<string, unknown>,
  aiCall: StageContext["aiCall"],
): StageContext {
  return {
    executionId: "exec-pg",
    threatModelId: "tm-pg",
    organizationId: "org-1",
    sessionId: "session-pg",
    inputs,
    aiCall,
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
  };
}

const ENTRY = {
  componentId: "comp-web-portal",
  componentName: "Customer Web Portal",
  justification: "Public web portal",
  exposure: 0.95,
};
const TARGET = {
  componentId: "comp-postgres",
  componentName: "PostgreSQL Primary",
  justification: "Crown-jewel datastore",
  value: 1.0,
};

const NEW_THREAT_NAME = "Lateral SQL injection into primary database";

/** One chain: portal → api-gateway → postgres. Last hop proposes a new threat. */
function stubChainResponse(): string {
  return JSON.stringify([
    {
      entryPointId: "comp-web-portal",
      targetAssetId: "comp-postgres",
      name: "Web portal to DB via API gateway",
      description: "Attacker pivots from the public portal to the database.",
      severity: "HIGH",
      hops: [
        {
          componentId: "comp-web-portal",
          threatRef: "comp-web-portal::existing-xss",
          description: "Exploit reflected XSS to steal a session.",
          preconditions: ["network:public"],
          yields: ["creds:user"],
          traversedBoundaryId: null,
        },
        {
          componentId: "comp-api-gateway",
          threatRef: "comp-api-gateway::existing-jwt",
          description: "Replay the stolen JWT through the gateway.",
          preconditions: ["creds:user"],
          yields: ["network:internal"],
          traversedBoundaryId: "boundary-dmz",
        },
        {
          componentId: "comp-postgres",
          threatRef: "placeholder-new",
          description: "Inject SQL via an internal service to read PII.",
          preconditions: ["network:internal"],
          yields: ["data:read:RESTRICTED"],
          traversedBoundaryId: "boundary-internal",
          newThreat: {
            name: NEW_THREAT_NAME,
            description: "Unsanitised internal query path enables SQLi.",
            category: "TAMPERING",
            severity: "CRITICAL",
          },
        },
      ],
    },
  ]);
}

describe("PathGenerator stage handler (pass 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStageRegistry();
    mockPrisma.threatModel.findUnique.mockResolvedValue({ id: "tm-pg" });
    // No DB components → persist treats hop.componentId as the nodeId verbatim.
    mockComponentFindMany.mockResolvedValue([]);
    mockMitigationDeleteMany.mockResolvedValue({ count: 0 });
    mockThreatCreate.mockResolvedValue({ id: "threat-new-1" });
    mockThreatUpdate.mockResolvedValue({ id: "threat-new-1" });
  });

  it("registers via stages/index.ts side-effect registration", () => {
    expect(() => getStage("PathGenerator")).toThrowError(/not registered/);
    registerStageHandlers();
    expect(getStage("PathGenerator")).toBe(pathGeneratorStage);
  });

  it("produces a chain entry→target, resolves hop threatRefs, persists the new threat once", async () => {
    const context = loadFixtureContext();
    const normalized = normalizeThreatName(NEW_THREAT_NAME);
    const expectedRef = `comp-postgres::${normalized}`;

    // First run: no existing threats → create; findFirst returns the new row.
    mockThreatFindMany.mockResolvedValue([]);
    mockThreatFindFirst.mockResolvedValue({ id: "threat-new-1" });

    let calls = 0;
    const result = await pathGeneratorStage(
      makeCtx(
        {
          context,
          entryPoints: [ENTRY],
          targetAssets: [TARGET],
          existingThreats: [
            {
              threatRef: "comp-web-portal::existing-xss",
              name: "Reflected XSS",
            },
          ],
          persist: { threatModelId: "tm-pg", userId: "user-1" },
        },
        async () => {
          calls++;
          return stubChainResponse();
        },
      ),
    );

    expect(calls).toBe(1); // one (entry,target) pair → one LLM call
    const chains = result.outputs.candidateChains as Array<{
      entryPointId: string;
      targetAssetId: string;
      entryPointName: string;
      targetAssetName: string;
      hops: Array<{
        threatRef: string;
        preconditions: string[];
        yields: string[];
      }>;
    }>;
    expect(chains).toHaveLength(1);
    expect(chains[0].entryPointId).toBe("comp-web-portal");
    expect(chains[0].targetAssetId).toBe("comp-postgres");
    expect(chains[0].entryPointName).toBe("Customer Web Portal");

    // Every hop carries capability tokens.
    for (const hop of chains[0].hops) {
      expect(Array.isArray(hop.preconditions)).toBe(true);
      expect(Array.isArray(hop.yields)).toBe(true);
      expect(hop.yields.length).toBeGreaterThan(0);
    }

    // The new-threat hop's threatRef was rewritten to the persisted handle.
    const lastHop = chains[0].hops[chains[0].hops.length - 1];
    expect(lastHop.threatRef).toBe(expectedRef);

    // Persisted exactly once (created) on the first run.
    expect(mockThreatCreate).toHaveBeenCalledTimes(1);
    expect(result.outputs.newThreatsPersisted).toBe(1);
  });

  it("persists a new-threat hop exactly once across two runs (dedup proof)", async () => {
    const context = loadFixtureContext();
    const normalized = normalizeThreatName(NEW_THREAT_NAME);

    const inputs = {
      context,
      entryPoints: [ENTRY],
      targetAssets: [TARGET],
      persist: { threatModelId: "tm-pg", userId: "user-1" },
    };
    const aiCall = async () => stubChainResponse();

    // --- Run 1: no existing threats → create. ---
    mockThreatFindMany.mockResolvedValueOnce([]); // persist's existing lookup
    mockThreatFindFirst.mockResolvedValueOnce({ id: "threat-new-1" });
    const r1 = await pathGeneratorStage(makeCtx(inputs, aiCall));
    expect(r1.outputs.newThreatsPersisted).toBe(1);

    // --- Run 2: the threat now EXISTS (PENDING) → update, not create. ---
    mockThreatFindMany.mockResolvedValueOnce([
      {
        id: "threat-new-1",
        name: NEW_THREAT_NAME,
        componentNodeId: "comp-postgres",
        reviewStatus: "PENDING",
        source: "AI_SUGGESTED",
        manuallyEdited: false,
      },
    ]);
    mockThreatFindFirst.mockResolvedValueOnce({ id: "threat-new-1" });
    const r2 = await pathGeneratorStage(makeCtx(inputs, aiCall));

    // Second run created NOTHING new — the dedup path matched + updated.
    expect(r2.outputs.newThreatsPersisted).toBe(0);
    // Across both runs: exactly ONE create, one update — no duplicate threat.
    expect(mockThreatCreate).toHaveBeenCalledTimes(1);
    expect(mockThreatUpdate).toHaveBeenCalledTimes(1);

    // Both runs resolved the hop to the SAME stable handle.
    const ref = `comp-postgres::${normalized}`;
    const hopsR1 = (
      r1.outputs.candidateChains as Array<{
        hops: Array<{ threatRef: string }>;
      }>
    )[0].hops;
    const hopsR2 = (
      r2.outputs.candidateChains as Array<{
        hops: Array<{ threatRef: string }>;
      }>
    )[0].hops;
    expect(hopsR1[hopsR1.length - 1].threatRef).toBe(ref);
    expect(hopsR2[hopsR2.length - 1].threatRef).toBe(ref);
  });

  it("drops a chain whose hop references a hallucinated componentId", async () => {
    const context = loadFixtureContext();
    const badChain = JSON.stringify([
      {
        entryPointId: "comp-web-portal",
        targetAssetId: "comp-postgres",
        name: "Bad chain",
        description: "Has a hop on a non-existent component.",
        severity: "HIGH",
        hops: [
          {
            componentId: "comp-DOES-NOT-EXIST",
            threatRef: "x::y",
            description: "Imaginary hop.",
            preconditions: ["network:public"],
            yields: ["code-exec"],
          },
        ],
      },
    ]);

    const result = await pathGeneratorStage(
      makeCtx(
        { context, entryPoints: [ENTRY], targetAssets: [TARGET] },
        async () => badChain,
      ),
    );
    expect(result.outputs.candidateChains).toHaveLength(0);
    expect(result.parseFailures.length).toBeGreaterThanOrEqual(1);
    expect(result.parseFailures[0].error).toMatch(/not in topology/);
  });

  it("caps (entry, target) pairs at maxChainPairs", async () => {
    const context = loadFixtureContext();
    let calls = 0;
    await pathGeneratorStage(
      makeCtx(
        {
          context,
          entryPoints: [ENTRY, { ...ENTRY, componentId: "comp-api-gateway" }],
          targetAssets: [
            TARGET,
            { ...TARGET, componentId: "comp-auth-service" },
          ],
          maxChainPairs: 1,
        },
        async () => {
          calls++;
          return "[]";
        },
      ),
    );
    expect(calls).toBe(1); // 2×2 pairs available, capped to 1
  });

  it("throws without context", async () => {
    await expect(
      pathGeneratorStage(
        makeCtx({ entryPoints: [], targetAssets: [] }, async () => "[]"),
      ),
    ).rejects.toThrow(/requires inputs.context/);
  });
});
