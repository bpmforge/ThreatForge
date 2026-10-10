/**
 * Refutation feedback loop: DB-free unit tests (stubbed aiCall).
 *
 * When > 40% of a (component, category) pair's threats are
 * refuted by the Verifier, that pair is re-queued ONCE through ThreatIdentifier
 * with a "previously refuted — do not re-propose" block in the re-run prompt,
 * tracking loopCount (hard cap 2). These tests stub aiCall and inspect the
 * exact prompts passed to it:
 *  - round 1: 5 threats for one pair, 3 refuted (60% > 40%) → EXACTLY ONE
 *    re-run for that pair, with the refuted block PRESENT in the re-run prompt;
 *    loopCount === 2 and never exceeds 2.
 *  - a pair at ≤ 40% refuted does NOT re-run (loopCount === 1, no block).
 */
import { describe, it, expect } from "vitest";
import type { ThreatModelContext } from "../../../types/ai.js";
import type { MicroThreat } from "../micro-analysis/types.js";
import { verifierStage, type VerifierInputs } from "./verifier.js";
import type { StageContext } from "./registry.js";
import type { ThreatIdentifierInputs } from "./identifier-inputs.js";

const REFUTED_BLOCK = "Previously refuted";

const context: ThreatModelContext = {
  name: "TM",
  components: [{ id: "api", type: "API", name: "API Gateway" }],
  connections: [],
  boundaries: [],
};

function threat(name: string): MicroThreat {
  return {
    name,
    description: `Threat ${name} on the API gateway`,
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
  };
}

/** ThreatIdentifier raw-context inputs for the re-run (DB-free). maxLoops=1
 *  disables the confidence/citation loops so each category fires exactly one
 *  identification call. */
const identifierInputs: ThreatIdentifierInputs = {
  context,
  options: {
    methodologies: ["stride"],
    categories: ["SPOOFING"],
    maxCategoryLoops: 1,
  },
};

/** Classify a prompt by content so one stub serves every stage call. */
function kindOf(user: string): "refute" | "identify" | "other" {
  if (user.includes("## Proposed threats to refute")) return "refute";
  if (user.includes("## Category:") && user.includes("## Task")) {
    return "identify";
  }
  return "other"; // compound sub-step etc. → empty array
}

interface StubControl {
  /** refutationReason → verdict; refute the first `refuteCount` distinct refs. */
  refuteCount: number;
  /** threats the re-run identification returns (default: one fresh threat). */
  rerunThreats?: Array<{ name: string }>;
  prompts: { refute: string[]; identify: string[] };
}

function makeStub(ctrl: StubControl): StageContext["aiCall"] {
  const refutedRefs = new Set<string>();
  return async (_system, user) => {
    const kind = kindOf(user);
    if (kind === "refute") {
      ctrl.prompts.refute.push(user);
      const refs = [...user.matchAll(/threatRef:\s*(.+)/g)].map((m) =>
        m[1].trim(),
      );
      return JSON.stringify(
        refs.map((threatRef) => {
          // Refute the first N distinct refs we ever see (round 1 = 3 of 5);
          // confirm everything after that (round 2 survivors are accepted).
          const shouldRefute =
            refutedRefs.size < ctrl.refuteCount && !refutedRefs.has(threatRef);
          if (shouldRefute) refutedRefs.add(threatRef);
          return shouldRefute
            ? {
                threatRef,
                verdict: "REFUTED",
                confidence: 0.9,
                refutationReason: "no anchor in architecture",
              }
            : { threatRef, verdict: "CONFIRMED", confidence: 0.9 };
        }),
      );
    }
    if (kind === "identify") {
      ctrl.prompts.identify.push(user);
      const out = ctrl.rerunThreats ?? [{ name: "Fresh spoof" }];
      return JSON.stringify(
        out.map((t) => ({
          name: t.name,
          description: `${t.name} reachable on API gateway. Not found: no public ref`,
          category: "SPOOFING",
          severity: "HIGH",
          confidence: 0.9,
        })),
      );
    }
    return "[]"; // compound / supplemental — no threats
  };
}

function makeCtx(
  inputs: VerifierInputs,
  aiCall: StageContext["aiCall"],
): StageContext {
  return {
    executionId: "exec-1",
    threatModelId: "tm-1",
    organizationId: "org-1",
    sessionId: "session-1",
    inputs: inputs as unknown as Record<string, unknown>,
    aiCall,
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
  };
}

describe("Verifier refutation feedback loop", () => {
  it("5 threats / 3 refuted (>40%) → exactly ONE re-run with the refuted block; loopCount=2", async () => {
    const ctrl: StubControl = {
      refuteCount: 3,
      prompts: { refute: [], identify: [] },
    };
    const inputs: VerifierInputs = {
      threats: [
        "Spoof API identity",
        "Replay session token",
        "Forge JWT claims",
        "Bypass API auth",
        "Impersonate gateway",
      ].map(threat),
      context,
      identifierInputs,
    };
    const result = await verifierStage(makeCtx(inputs, makeStub(ctrl)));

    // loopCount tracked and HARD-CAPPED at 2 (one initial pass + one re-run).
    expect(result.outputs.loopCount).toBe(2);
    expect(result.outputs.loopCount as number).toBeLessThanOrEqual(2);

    // The pair was re-queued: exactly ONE identification call for SPOOFING.
    const identifySpoofing = ctrl.prompts.identify.filter((p) =>
      p.includes("## Category: SPOOFING"),
    );
    expect(identifySpoofing).toHaveLength(1);

    // The re-run prompt carries the "previously refuted — do not re-propose"
    // block naming the 3 refuted threats with their reasons.
    const rerunPrompt = identifySpoofing[0];
    expect(rerunPrompt).toContain(REFUTED_BLOCK);
    expect(rerunPrompt).toContain("DO NOT re-propose");
    expect(rerunPrompt).toContain("no anchor in architecture");
    // 3 refuted threat names appear in the block (the first 3 were refuted).
    expect(rerunPrompt).toMatch(/- Spoof API identity —/);
    expect(rerunPrompt).toMatch(/- Replay session token —/);
    expect(rerunPrompt).toMatch(/- Forge JWT claims —/);

    // requeueCandidates still surfaced in the same shape as the verifier stage.
    expect(result.outputs.requeueCandidates).toEqual([
      { componentId: "api", category: "SPOOFING" },
    ]);
  });

  it("does NOT re-run twice even if the re-run is also heavily refuted (cap 2)", async () => {
    // refuteCount huge → every refutation call refutes everything it sees, so
    // the re-run's fresh threat is ALSO refuted (>40%). The cap must still hold.
    const ctrl: StubControl = {
      refuteCount: 99,
      prompts: { refute: [], identify: [] },
    };
    const inputs: VerifierInputs = {
      threats: [
        "Spoof API identity",
        "Replay session token",
        "Forge JWT claims",
        "Bypass API auth",
        "Impersonate gateway",
      ].map(threat),
      context,
      identifierInputs,
    };
    const result = await verifierStage(makeCtx(inputs, makeStub(ctrl)));

    expect(result.outputs.loopCount).toBe(2);
    // Only ONE re-run identification for SPOOFING — never a third pass.
    const identifySpoofing = ctrl.prompts.identify.filter((p) =>
      p.includes("## Category: SPOOFING"),
    );
    expect(identifySpoofing).toHaveLength(1);
  });

  it("≤40% refuted → NO re-run, loopCount=1, no refuted block emitted", async () => {
    // 5 threats, only 2 refuted = 40% — NOT > 40%, so no re-queue.
    const ctrl: StubControl = {
      refuteCount: 2,
      prompts: { refute: [], identify: [] },
    };
    const inputs: VerifierInputs = {
      threats: [
        "Spoof API identity",
        "Replay session token",
        "Forge JWT claims",
        "Bypass API auth",
        "Impersonate gateway",
      ].map(threat),
      context,
      identifierInputs,
    };
    const result = await verifierStage(makeCtx(inputs, makeStub(ctrl)));

    expect(result.outputs.loopCount).toBe(1);
    expect(result.outputs.requeueCandidates).toEqual([]);
    // No identification call happened at all → no re-run prompt, no block.
    expect(ctrl.prompts.identify).toHaveLength(0);
  });

  it("re-queue is a no-op when identifierInputs is absent (loopCount stays 1)", async () => {
    const ctrl: StubControl = {
      refuteCount: 3,
      prompts: { refute: [], identify: [] },
    };
    const inputs: VerifierInputs = {
      threats: [
        "Spoof API identity",
        "Replay session token",
        "Forge JWT claims",
        "Bypass API auth",
        "Impersonate gateway",
      ].map(threat),
      context,
      // identifierInputs omitted — the loop cannot run.
    };
    const result = await verifierStage(makeCtx(inputs, makeStub(ctrl)));
    expect(result.outputs.loopCount).toBe(1);
    expect(ctrl.prompts.identify).toHaveLength(0);
    // The candidates are still recorded for observability.
    expect(result.outputs.requeueCandidates).toEqual([
      { componentId: "api", category: "SPOOFING" },
    ]);
  });
});
