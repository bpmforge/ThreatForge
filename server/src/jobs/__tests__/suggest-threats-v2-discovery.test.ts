/**
 * Loop-until-dry discovery loop — unit tests over the injected runRound.
 *
 * The loop is pure orchestration (round counting, the maxRounds cap, the
 * already-found accumulation, net-new measurement by ADR-006 key), so it is
 * tested with a controllable stub runRound that returns scripted new/old threat
 * sets per round. No pipeline, no DB.
 */
import { describe, it, expect, vi } from "vitest";
import type { MicroThreat } from "../../services/ai/micro-analysis/types.js";
import {
  buildAlreadyFoundBlock,
  runDiscoveryLoop,
  DISCOVERY_DEFAULT,
  type RoundRequest,
  type RoundOutcome,
} from "../suggest-threats-v2-discovery.js";

function threat(
  name: string,
  overrides: Partial<MicroThreat> = {},
): MicroThreat {
  return {
    name,
    description: `desc ${name}`,
    category: "SPOOFING",
    severity: "HIGH",
    componentId: "api",
    componentName: "API Gateway",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "MEDIUM", effectiveness: "0.5" },
    confidence: 0.8,
    sourceMethodology: "stride",
    ...overrides,
  };
}

/** All survivors are CONFIRMED unless an override carves out the confirmed set. */
function outcome(
  threats: MicroThreat[],
  confirmed?: MicroThreat[],
): RoundOutcome {
  return { verifiedThreats: threats, confirmedThreats: confirmed ?? threats };
}

describe("runDiscoveryLoop", () => {
  // The normalizer drops <2-char tokens and sorts, so distinct keys need
  // distinct multi-char words. `word(i)` yields a unique normalizable name.
  const word = (i: number) => `threat${String.fromCharCode(97 + i)}xx`;

  it("single mode (default) runs exactly one round — no extra rounds", async () => {
    const runRound = vi.fn(async () =>
      outcome([
        threat("alpha replay"),
        threat("beta inject"),
        threat("gamma leak"),
      ]),
    );
    const res = await runDiscoveryLoop({
      config: DISCOVERY_DEFAULT, // { mode: "single", maxRounds: 3 }
      runRound,
    });
    expect(runRound).toHaveBeenCalledTimes(1);
    expect(res.roundsRun).toBe(1);
    expect(res.newPerRound).toEqual([3]);
    expect(res.finalSet).toHaveLength(3);
  });

  it("until-dry: 8 new → 2 new → 0 new stops after exactly 3 rounds", async () => {
    // Each round returns ALL accumulated names plus its delta, so the loop must
    // measure net-new (not raw count) by ADR-006 key to get 8 / 2 / 0.
    const r1 = Array.from({ length: 8 }, (_, i) => threat(word(i)));
    const r2 = [...r1, threat(word(8)), threat(word(9))]; // 2 net-new
    const r3 = [...r2]; // 0 net-new (only re-proposals)
    const scripted = [outcome(r1), outcome(r2), outcome(r3)];
    let call = 0;
    const runRound = vi.fn(async () => scripted[call++]);

    const res = await runDiscoveryLoop({
      config: { mode: "until-dry", maxRounds: 5 },
      runRound,
    });

    expect(runRound).toHaveBeenCalledTimes(3);
    expect(res.roundsRun).toBe(3);
    expect(res.newPerRound).toEqual([8, 2, 0]);
    // Final set is the deduped union: 10 distinct threats (T0..T9).
    expect(res.finalSet).toHaveLength(10);
  });

  it("cap: an always-new stub stops at maxRounds (default 3)", async () => {
    // Every round invents brand-new threats, so net-new never hits 0; only the
    // maxRounds cap can stop it.
    let n = 0;
    const runRound = vi.fn(async () =>
      outcome([threat(word(n++)), threat(word(n++))]),
    );
    const res = await runDiscoveryLoop({
      config: { mode: "until-dry", maxRounds: 3 },
      runRound,
    });
    expect(runRound).toHaveBeenCalledTimes(3);
    expect(res.roundsRun).toBe(3);
    expect(res.newPerRound).toEqual([2, 2, 2]);
    expect(res.finalSet).toHaveLength(6);
  });

  it("re-runs carry the already-found block built from prior CONFIRMED names", async () => {
    const seenBlocks: Array<RoundRequest["alreadyFound"]> = [];
    let call = 0;
    const r1 = [
      threat("Token replay", { componentId: "api", category: "SPOOFING" }),
      threat("SQL injection", { componentId: "db", category: "TAMPERING" }),
    ];
    const r2 = [
      ...r1,
      threat("CSRF", { componentId: "api", category: "SPOOFING" }),
    ];
    const scripted = [outcome(r1), outcome(r2), outcome(r2)];

    const runRound = vi.fn(async (req: RoundRequest) => {
      seenBlocks.push(req.alreadyFound);
      return scripted[call++];
    });

    await runDiscoveryLoop({
      config: { mode: "until-dry", maxRounds: 5 },
      runRound,
    });

    // Round 1 has no already-found block (first pass prompt unchanged).
    expect(seenBlocks[0]).toBeUndefined();
    // Round 2's block carries BOTH prior confirmed names, keyed component::cat.
    expect(seenBlocks[1]).toEqual({
      "api::SPOOFING": [{ name: "Token replay" }],
      "db::TAMPERING": [{ name: "SQL injection" }],
    });
    // Round 3's block additionally carries the CSRF found in round 2.
    expect(seenBlocks[2]).toEqual({
      "api::SPOOFING": [{ name: "Token replay" }, { name: "CSRF" }],
      "db::TAMPERING": [{ name: "SQL injection" }],
    });
  });

  it("does not loop when round 1 produces 0 net-new CONFIRMED threats", async () => {
    // Survivors exist but all are UNCERTAIN (confirmed set empty) → no trigger.
    const survivors = [threat("Maybe", { confidence: 0.5 })];
    const runRound = vi.fn(async () => outcome(survivors, []));
    const res = await runDiscoveryLoop({
      config: { mode: "until-dry", maxRounds: 3 },
      runRound,
    });
    expect(runRound).toHaveBeenCalledTimes(1);
    expect(res.roundsRun).toBe(1);
  });

  it("re-run scope is restricted to affected components", async () => {
    const seenScopes: Array<RoundRequest["affectedComponentIds"]> = [];
    let call = 0;
    const r1 = [
      threat("A", { componentId: "api" }),
      threat("B", { componentId: "db" }),
    ];
    const r2 = [...r1, threat("C", { componentId: "api" })];
    const scripted = [outcome(r1), outcome(r2), outcome(r2)];
    const runRound = vi.fn(async (req: RoundRequest) => {
      seenScopes.push(req.affectedComponentIds);
      return scripted[call++];
    });
    await runDiscoveryLoop({
      config: { mode: "until-dry", maxRounds: 5 },
      runRound,
    });
    expect(seenScopes[0]).toBeUndefined(); // round 1 = full scope
    expect(new Set(seenScopes[1])).toEqual(new Set(["api", "db"]));
  });
});

describe("buildAlreadyFoundBlock", () => {
  it("keys by componentId::category and omits model-wide/compound threats", () => {
    const block = buildAlreadyFoundBlock([
      threat("A", { componentId: "api", category: "SPOOFING" }),
      threat("B", { componentId: "api", category: "SPOOFING" }),
      threat("C", { componentId: "db", category: "TAMPERING" }),
      threat("Compound", {
        componentId: "compound",
        category: "INFO_DISCLOSURE",
      }),
      threat("ModelWide", { componentId: "", category: "DOS" }),
    ]);
    expect(block).toEqual({
      "api::SPOOFING": [{ name: "A" }, { name: "B" }],
      "db::TAMPERING": [{ name: "C" }],
    });
  });
});

describe("refuted set carried across rounds", () => {
  const spoof = { componentId: "api", category: "SPOOFING" } as const;

  it("appends refuted threats with their reason; survivors win name clashes", () => {
    const block = buildAlreadyFoundBlock(
      [threat("Token replay", spoof)],
      [
        { threat: threat("Fake claim", spoof), reason: "no such endpoint" },
        { threat: threat("Token replay", spoof), reason: "dup" },
      ],
    );
    expect(block).toEqual({
      "api::SPOOFING": [
        { name: "Token replay" },
        { name: "Fake claim", reason: "no such endpoint" },
      ],
    });
  });

  it("round 2's block includes round 1's refuted threats", async () => {
    const seen: Array<RoundRequest["alreadyFound"]> = [];
    let call = 0;
    const r1 = [threat("Token replay", spoof)];
    const scripted: RoundOutcome[] = [
      {
        ...outcome(r1),
        refutedThreats: [
          { threat: threat("Fake claim", spoof), reason: "not reachable" },
        ],
      },
      outcome(r1),
    ];
    await runDiscoveryLoop({
      config: { mode: "until-dry", maxRounds: 3 },
      runRound: async (req) => {
        seen.push(req.alreadyFound);
        return scripted[call++];
      },
    });
    expect(seen[1]?.["api::SPOOFING"]).toContainEqual({
      name: "Fake claim",
      reason: "not reachable",
    });
  });
});
