/**
 * Record the expert-pass prompts into the A0-1 parity journal (A3-1).
 *
 * Runs the 6 expert passes on the go-forward fixture in RECORD mode against
 * LM Studio, APPENDING every prompt/response exchange to the existing
 * server/src/test/fixtures/go-forward/llm-journal.json (the recorder upserts
 * by sha256(prompt), so the micro-pipeline entries already there are kept).
 *
 * The pass sequence here is the EXACT same prompts + hand-offs the legacy
 * runExpertAnalysis and the v2 runExpertAnalysisV2 orchestrators build (it
 * reuses the same exported PASS constants, buildPassNInput helpers, and parse
 * helpers), so the recorded hashes replay for BOTH paths. No DB is touched —
 * recording is network-only, mirroring record-parity-journal.ts.
 *
 * Usage from server/ directory:
 *   npx tsx scripts/record-expert-journal.ts
 *
 * Env overrides: LM_STUDIO_URL, LM_STUDIO_FALLBACK_URL, LM_STUDIO_MODEL.
 *
 * X-04: PARITY_PROVIDER=openai records against an OpenAI-compatible server
 * (the MTPLX app) with OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL, through
 * the same metered caller the worker's expert path uses: passes 1–4 tagged
 * "analysis", pass 5 "reviewer" (generation-settings rows). Every
 * prompt's estimated token size is printed, and the largest at the end — the
 * X-04 before/after measure.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createReplayAICaller } from "../src/test/helpers/replay-ai.js";
import { loadFixtureContext } from "../src/test/helpers/fixture-context.js";
import { LMStudioClient } from "../src/services/ai/providers/lmstudio.js";
import { OpenAIClient } from "../src/services/ai/providers/openai.js";
import {
  TokenMeter,
  meteredAiCall,
} from "../src/services/ai/providers/token-meter.js";
import type { AICallFn } from "../src/services/ai/micro-analysis/types.js";
import {
  applyExpertVerification,
  buildPass2Input,
  buildPass3Input,
  buildPass4Input,
  buildPass5Input,
  consolidateExpertThreats,
  EXPERT_PASS_PROMPTS,
  formatContext,
  MAX_VERIFICATION_LOOPS,
  parseThreatsJson,
  type ExpertThreat,
} from "../src/services/ai/expert-analysis.js";

const PRIMARY_URL =
  process.env.LM_STUDIO_URL ?? "http://lmstudio-host.internal:1234/v1";
const FALLBACK_URL =
  process.env.LM_STUDIO_FALLBACK_URL ??
  "http://lmstudio-fallback.internal:1234/v1";
const MODEL = process.env.LM_STUDIO_MODEL ?? "qwen/qwen3-coder-next";

const FIXTURES_DIR = join(
  import.meta.dirname,
  "..",
  "src",
  "test",
  "fixtures",
  "go-forward",
);
const JOURNAL_PATH = join(FIXTURES_DIR, "llm-journal.json");

async function pickBaseUrl(): Promise<string> {
  for (const url of [PRIMARY_URL, FALLBACK_URL]) {
    try {
      const res = await fetch(`${url}/models`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return url;
    } catch {
      // try next host
    }
  }
  throw new Error(
    `No LM Studio host reachable (tried ${PRIMARY_URL}, ${FALLBACK_URL})`,
  );
}

async function main(): Promise<void> {
  const context = loadFixtureContext(FIXTURES_DIR);
  let realCaller: AICallFn;
  const tokenMeter = new TokenMeter();
  if (process.env.EXPERT_REPLAY) {
    console.log(`Replaying expert passes from ${JOURNAL_PATH}`);
    realCaller = async () => {
      throw new Error("replay mode makes no provider calls");
    };
  } else if (process.env.PARITY_PROVIDER === "openai") {
    const { OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL } = process.env;
    if (!OPENAI_BASE_URL || !OPENAI_API_KEY || !OPENAI_MODEL) {
      throw new Error(
        "PARITY_PROVIDER=openai requires OPENAI_BASE_URL, OPENAI_API_KEY and OPENAI_MODEL",
      );
    }
    console.log(
      `Recording expert passes against ${OPENAI_BASE_URL} (${OPENAI_MODEL}) via openai`,
    );
    const client = new OpenAIClient(
      OPENAI_API_KEY,
      OPENAI_MODEL,
      OPENAI_BASE_URL,
    );
    // Same shape as ai-worker.ts's expert caller: temperature 0.3, 45000
    // tokens for unstaged passes, the settings row for a named stage.
    realCaller = meteredAiCall(client, tokenMeter, {
      temperature: 0.3,
      maxTokens: 45000,
    });
  } else {
    const baseUrl = await pickBaseUrl();
    console.log(`Recording expert passes against ${baseUrl} (${MODEL})`);
    const client = new LMStudioClient(baseUrl, MODEL);
    realCaller = async (system, user) => {
      const resp = await client.complete({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        maxTokens: 45000,
      });
      return resp.content;
    };
  }
  // EXPERT_REPLAY=1 rebuilds the run from the journal (no network) — used to
  // recompute metrics for a recorded run.
  const recorder = process.env.EXPERT_REPLAY
    ? createReplayAICaller(JOURNAL_PATH, "replay")
    : createReplayAICaller(JOURNAL_PATH, "record", realCaller);
  let largestPrompt = 0;
  const rec: AICallFn = async (system, user, stage) => {
    const tokens = Math.ceil((system.length + user.length) / 4);
    largestPrompt = Math.max(largestPrompt, tokens);
    console.log(`  prompt ≈ ${tokens} tokens${stage ? ` (${stage})` : ""}`);
    return recorder(system, user, stage);
  };

  const archContext = formatContext(context);

  console.log("Pass 1 — Understand");
  const pass1 = await rec(
    EXPERT_PASS_PROMPTS.PASS_1_UNDERSTAND,
    archContext,
    "analysis",
  );

  console.log("Pass 2 — Data Flows");
  const pass2 = await rec(
    EXPERT_PASS_PROMPTS.PASS_2_FLOWS,
    buildPass2Input(archContext, pass1),
    "analysis",
  );

  console.log("Pass 3 — Identify Threats");
  const pass3Raw = await rec(
    EXPERT_PASS_PROMPTS.PASS_3_THREATS,
    buildPass3Input(archContext, pass1, pass2),
    "analysis",
  );
  const threats = parseThreatsJson(pass3Raw);

  console.log(`Pass 4 — Attack Chains (${threats.length} threats so far)`);
  const pass4Raw = await rec(
    EXPERT_PASS_PROMPTS.PASS_4_CHAINS,
    buildPass4Input(archContext, threats),
    "analysis",
  );
  const chainThreats = parseThreatsJson(pass4Raw);

  let allThreats: ExpertThreat[] = [...threats, ...chainThreats];
  for (let loop = 0; loop < MAX_VERIFICATION_LOOPS; loop++) {
    console.log(`Pass 5 — Verify (loop ${loop + 1})`);
    const pass5Raw = await rec(
      EXPERT_PASS_PROMPTS.PASS_5_VERIFY,
      buildPass5Input(archContext, pass1, pass2, allThreats),
      "reviewer",
    );
    const applied = applyExpertVerification(allThreats, pass5Raw);
    allThreats = applied.threats;
    console.log(`  ${applied.summary}`);
    if (applied.done) break;
  }

  const deduped = consolidateExpertThreats(allThreats);
  console.log("\n--- Recording complete ---");
  console.log(`Final expert threats: ${deduped.length}`);
  console.log(`Largest prompt: ≈ ${largestPrompt} tokens`);
  console.log(
    `Recall (same matcher as eval-run.ts): ${expertRecall(deduped, context)}`,
  );
  console.log(`Tokens: ${JSON.stringify(tokenMeter.totals())}`);
  console.log(`Journal: ${JOURNAL_PATH}`);
}

/**
 * X-04 — recall of the final expert set against expected-threats.json, with
 * eval-run.ts's matcher (same component + a match term in the normalized
 * title), so expert-mode recall reads on the same scale as the micro eval.
 */
function expertRecall(
  threats: ExpertThreat[],
  context: ReturnType<typeof loadFixtureContext>,
): string {
  // Expert threats name their component (targetComponentId is often the
  // component NAME); map name or id to the fixture id the expectations use.
  const idByKey = new Map<string, string>();
  for (const c of context.components) {
    idByKey.set(c.id.toLowerCase(), c.id);
    idByKey.set(c.name.toLowerCase(), c.id);
  }
  const componentIdOf = (t: ExpertThreat) =>
    idByKey.get((t.targetComponentId ?? "").toLowerCase()) ??
    idByKey.get((t.targetComponentName ?? "").toLowerCase()) ??
    t.targetComponentId;
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .join(" ");
  const file = JSON.parse(
    readFileSync(join(FIXTURES_DIR, "expected-threats.json"), "utf8"),
  ) as {
    expected: Array<{
      componentId: string;
      match: string[];
      enabled?: boolean;
    }>;
  };
  const expected = file.expected.filter((e) => e.enabled !== false);
  const got = threats.map((t) => ({
    componentId: componentIdOf(t),
    norm: normalize(t.title),
  }));
  const matched = expected.filter((e) =>
    got.some(
      (g) =>
        g.componentId === e.componentId &&
        e.match.some((m) => g.norm.includes(normalize(m))),
    ),
  ).length;
  return `${matched}/${expected.length}`;
}

main().catch((err) => {
  console.error("Expert recording failed:", err);
  process.exit(1);
});
