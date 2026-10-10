/**
 * Record the A0-1 parity journal.
 *
 * Runs the legacy micro-analysis pipeline on the go-forward fixture model in
 * RECORD mode against a real model, writing every prompt/response exchange
 * to server/src/test/fixtures/go-forward/llm-journal.json. The pipeline runs
 * WITHOUT a persist target, so no database is required and no DB IDs can
 * leak into prompts (component ids in the fixture are already human-readable
 * node ids, per ADR-006).
 *
 * Usage from server/ directory:
 *   npx tsx scripts/record-parity-journal.ts
 *
 * Provider selection: defaults to LM Studio so existing behaviour is
 * unchanged. Set PARITY_PROVIDER=openai to record against any OpenAI-compatible
 * endpoint instead (for example a local model server).
 *
 * Env overrides — LM Studio (default, PARITY_PROVIDER unset or "lmstudio"):
 *   LM_STUDIO_URL   (default http://lmstudio-host.internal:1234/v1)
 *   LM_STUDIO_FALLBACK_URL (default http://lmstudio-fallback.internal:1234/v1)
 *   LM_STUDIO_MODEL (default qwen/qwen3-coder-next)
 *
 * X-05: calls that name a stage (category, mitigation, dedup, compound,
 * calibration — every micro call) take thinking and max_tokens from
 * services/ai/generation-settings.ts, the same table the app uses, through
 * meteredAiCall. PARITY_THINKING and PARITY_MAX_TOKENS below apply only to
 * unstaged calls.
 *
 * Env overrides — OpenAI-compatible (PARITY_PROVIDER=openai):
 *   OPENAI_BASE_URL  (required, e.g. http://127.0.0.1:8000 — no /v1 suffix,
 *                     OpenAIClient appends /v1/chat/completions and /v1/models)
 *   OPENAI_API_KEY   (required, Bearer token)
 *   OPENAI_MODEL     (required, model id)
 *   PARITY_MAX_TOKENS (default 3000; keep >= 400, since a reasoning model
 *                     spends tokens on <think> content before its answer —
 *                     but do NOT set this anywhere near the LM Studio path's
 *                     45000: OpenAIClient's fetch is Node's built-in
 *                     undici-backed fetch, whose global dispatcher has a
 *                     300s HEADERS timeout that fires regardless of
 *                     AI_PROVIDER_TIMEOUT_MS/completionSignal, because MTPLX's
 *                     /v1/chat/completions is non-streaming — it holds the
 *                     connection until the full completion is generated, so
 *                     "headers" effectively means "generation done". Measured
 *                     against this MTPLX server: ~13 completion-tok/s on a
 *                     non-trivial prompt, so 3000 tokens is a ~230s budget,
 *                     safely under the 300s ceiling. Going higher risks every
 *                     call failing with "fetch failed: Headers Timeout Error"
 *                     (confirmed empirically: 45000 timed out every single
 *                     category during M-01's baseline recording).
 *   AI_PROVIDER_TIMEOUT_MS  (recommend ~280000 for this provider — high enough
 *                     for a full-budget MTPLX response, still under undici's
 *                     300s hard ceiling so a genuine hang aborts cleanly with
 *                     our own timeout error instead of the opaque undici one)
 *   PARITY_THINKING  ("on", default, or "off") — off sends top-level
 *                     `enable_thinking: false` on every /v1/chat/completions
 *                     call, which MTPLX honours (verified empirically: same
 *                     prompt, same max_tokens, thinking on used all 3189
 *                     completion tokens on reasoning + answer in 241s;
 *                     thinking off answered directly in 1516 tokens, 68s, no
 *                     reasoning_tokens in usage). `reasoning_effort` cannot
 *                     turn thinking off — its "none"/"off" values alias to
 *                     "low" on this server. Implemented as a small
 *                     script-local client rather than touching OpenAIClient
 *                     (out of this ticket's write scope) — behaviour is
 *                     byte-identical to OpenAIClient.complete when thinking
 *                     is on (the default).
 */
import { join } from "node:path";
import { runMicroAnalysis } from "../src/services/ai/micro-analysis/pipeline.js";
import { createReplayAICaller } from "../src/test/helpers/replay-ai.js";
import { loadFixtureContext } from "../src/test/helpers/fixture-context.js";
import { LMStudioClient } from "../src/services/ai/providers/lmstudio.js";
import { OpenAIClient } from "../src/services/ai/providers/openai.js";
import {
  TokenMeter,
  meteredAiCall,
} from "../src/services/ai/providers/token-meter.js";
import { limitInflight } from "../src/services/ai/providers/inflight-limiter.js";
import { completionSignal } from "../src/services/ai/provider-timeout.js";
import type {
  AIProviderClient,
  AICompletionOptions,
  AICompletionResponse,
} from "../src/types/ai.js";

const FIXTURES_DIR = join(
  import.meta.dirname,
  "..",
  "src",
  "test",
  "fixtures",
  "go-forward",
);
const JOURNAL_PATH = join(FIXTURES_DIR, "llm-journal.json");

const MIN_MAX_TOKENS = 400;

export interface ParityProviderEnv {
  PARITY_PROVIDER?: string;
  LM_STUDIO_URL?: string;
  LM_STUDIO_FALLBACK_URL?: string;
  LM_STUDIO_MODEL?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  PARITY_MAX_TOKENS?: string;
  PARITY_THINKING?: string;
}

export type ParitySelection =
  | {
      provider: "lmstudio";
      primaryUrl: string;
      fallbackUrl: string;
      model: string;
      maxTokens: number;
    }
  | {
      provider: "openai";
      baseUrl: string;
      apiKey: string;
      model: string;
      maxTokens: number;
      thinking: boolean;
    };

/**
 * Pure provider selection, kept separate from the network calls below so it
 * can be unit tested without a reachable model server. Throws on openai with
 * missing required env rather than silently falling back — a baseline
 * recording with the wrong provider is worse than a loud failure.
 */
export function selectProvider(env: ParityProviderEnv): ParitySelection {
  const requested = env.PARITY_PROVIDER ?? "lmstudio";
  const maxTokens = Math.max(
    MIN_MAX_TOKENS,
    Number(env.PARITY_MAX_TOKENS) || 3000,
  );

  if (requested === "openai") {
    const baseUrl = env.OPENAI_BASE_URL;
    const apiKey = env.OPENAI_API_KEY;
    const model = env.OPENAI_MODEL;
    if (!baseUrl || !apiKey || !model) {
      throw new Error(
        "PARITY_PROVIDER=openai requires OPENAI_BASE_URL, OPENAI_API_KEY and OPENAI_MODEL",
      );
    }
    const thinkingRaw = env.PARITY_THINKING ?? "on";
    if (thinkingRaw !== "on" && thinkingRaw !== "off") {
      throw new Error(
        `Unknown PARITY_THINKING "${thinkingRaw}" — expected "on" or "off"`,
      );
    }
    return {
      provider: "openai",
      baseUrl,
      apiKey,
      model,
      maxTokens,
      thinking: thinkingRaw === "on",
    };
  }

  if (requested !== "lmstudio") {
    throw new Error(
      `Unknown PARITY_PROVIDER "${requested}" — expected "lmstudio" or "openai"`,
    );
  }

  return {
    provider: "lmstudio",
    primaryUrl: env.LM_STUDIO_URL ?? "http://lmstudio-host.internal:1234/v1",
    fallbackUrl:
      env.LM_STUDIO_FALLBACK_URL ?? "http://lmstudio-fallback.internal:1234/v1",
    model: env.LM_STUDIO_MODEL ?? "qwen/qwen3-coder-next",
    maxTokens,
  };
}

async function pickLMStudioUrl(
  primary: string,
  fallback: string,
): Promise<string> {
  for (const url of [primary, fallback]) {
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
    `No LM Studio host reachable (tried ${primary}, ${fallback})`,
  );
}

/** Same readiness check LM Studio gets (a live GET against the models list),
 * done through the client's own isAvailable() so the openai path exercises
 * the real Bearer-auth request an operator would see fail first. */
async function assertOpenAIReady(client: AIProviderClient): Promise<void> {
  const ok = await client.isAvailable();
  if (!ok) {
    throw new Error(
      "OpenAI-compatible endpoint not reachable/authorized (GET /v1/models failed)",
    );
  }
}

interface OpenAICompletionResult {
  choices?: Array<{ message?: { content: string } }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Wraps OpenAIClient to add `enable_thinking: false` to the request body
 * (PARITY_THINKING=off). Delegates isAvailable() to a real OpenAIClient
 * unchanged. complete() duplicates OpenAIClient's text-only request shape
 * rather than subclassing, because formatMessageForOpenAI is private and
 * this script never sends multimodal content — record-parity-journal always
 * calls with plain system/user strings (see AICallFn's realCaller below).
 */
class ThinkingToggleOpenAIClient implements AIProviderClient {
  readonly provider = "openai" as const;
  private inner: OpenAIClient;

  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl: string,
  ) {
    this.inner = new OpenAIClient(apiKey, model, baseUrl);
  }

  isAvailable(): Promise<boolean> {
    return this.inner.isAvailable();
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResponse> {
    const messages = options.messages.map((m) => ({
      role: m.role,
      content: String(m.content),
    }));

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      signal: completionSignal(options.signal),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens || 4096,
        messages,
        temperature: options.temperature ?? 0.7,
        enable_thinking: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OpenAICompletionResult;
    const content = data.choices?.[0]?.message?.content || "";

    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      provider: "openai",
      model: this.model,
    };
  }
}

async function buildClient(
  selection: ParitySelection,
): Promise<{ client: AIProviderClient; label: string }> {
  if (selection.provider === "openai") {
    const client = selection.thinking
      ? new OpenAIClient(selection.apiKey, selection.model, selection.baseUrl)
      : new ThinkingToggleOpenAIClient(
          selection.apiKey,
          selection.model,
          selection.baseUrl,
        );
    await assertOpenAIReady(client);
    const thinkingLabel = selection.thinking ? "" : ", thinking OFF";
    return {
      client,
      label: `${selection.baseUrl} (${selection.model}${thinkingLabel})`,
    };
  }

  const baseUrl = await pickLMStudioUrl(
    selection.primaryUrl,
    selection.fallbackUrl,
  );
  return {
    client: new LMStudioClient(baseUrl, selection.model),
    label: `${baseUrl} (${selection.model})`,
  };
}

async function main(): Promise<void> {
  const context = loadFixtureContext(FIXTURES_DIR);

  const selection = selectProvider(process.env as ParityProviderEnv);
  const built = await buildClient(selection);
  const { label } = built;
  // X-06: same in-flight bound the app applies to local endpoints.
  const client = limitInflight(
    built.client,
    selection.provider === "openai" ? selection.baseUrl : undefined,
  );
  console.log(`Recording against ${label} via ${selection.provider}`);

  // Same shape as the aiCall ai-worker.ts builds for the micro pipeline:
  // temperature 0.3. maxTokens is 45000 for LM Studio's local default; the
  // openai (MTPLX) path uses selection.maxTokens, kept >= 400 because a
  // reasoning model spends tokens on <think> content before the answer.
  const maxTokens =
    selection.provider === "lmstudio" ? 45000 : selection.maxTokens;
  const tokenMeter = new TokenMeter();
  const realCaller = meteredAiCall(client, tokenMeter, {
    temperature: 0.3,
    maxTokens,
  });

  const recordingCaller = createReplayAICaller(
    JOURNAL_PATH,
    "record",
    realCaller,
  );

  // Record the micro path unless --agentic-only is passed (A3-2 top-up).
  const agenticOnly = process.argv.includes("--agentic-only");
  const skipMicro = agenticOnly || process.argv.includes("--skip-micro");

  // B8/B11 give runMicroAnalysis a default 25-minute wall-clock budget, sized
  // against the ai-heavy BullMQ lock. This script is an offline recording
  // tool with no lock to respect, and 12 components x 6 STRIDE categories
  // against a slower model can run well past 25 minutes — so pass an
  // explicit, much larger budget rather than let the production default
  // silently truncate a baseline recording. Override with PARITY_BUDGET_MS
  // if even this is not enough.
  const budgetMs = Number(process.env.PARITY_BUDGET_MS) || 4 * 60 * 60 * 1000;

  const started = Date.now();
  if (!skipMicro) {
    const result = await runMicroAnalysis(context, recordingCaller, {
      methodologies: ["stride"],
      deadlineAt: started + budgetMs,
      tokenMeter,
      onProgress: (phase, detail) => {
        console.log(
          `[${((Date.now() - started) / 1000).toFixed(0)}s] [${phase}] ${detail}`,
        );
      },
    });
    console.log("\n--- Micro recording complete ---");
    console.log(`Threats: ${result.summary.totalThreats}`);
    console.log(`LLM calls: ${result.summary.llmCalls}`);
    console.log(`Parse failures: ${result.summary.parseFailures}`);
    console.log(`Duration: ${(result.summary.duration / 1000).toFixed(0)}s`);
    // X-01: paste this into the seed's manifest.json entry; eval-run prints it.
    console.log(`Tokens: ${JSON.stringify({ tokens: result.summary.tokens })}`);
    if (result.summary.deadlineStopped) {
      console.warn(
        `WARNING: deadline-stopped — ${result.summary.skippedComponentCount} component(s) ` +
          `skipped (B8 wall-clock bound). This recording is INCOMPLETE.`,
      );
    }
  }

  // A3-2 — also record the agentic multi-framework prompts (STRIDE / PASTA /
  // Kill Chain / MITRE runners + the verify loop). The legacy path drives an
  // AIProviderClient.complete; we adapt the recording AICallFn to that shape so
  // the recorded (system, user) hashes are exactly what the replay caller (and
  // both the legacy + v2 agentic paths) look up.
  if (agenticOnly || process.argv.includes("--agentic")) {
    const { runAgenticAnalysis } = await import(
      "../src/services/ai/agentic-analysis.js"
    );
    const recordingClient = {
      provider: selection.provider,
      isAvailable: async () => true,
      complete: async (opts: {
        messages: Array<{ role: string; content: string }>;
      }) => {
        const sys =
          opts.messages.find((m) => m.role === "system")?.content ?? "";
        const usr = opts.messages.find((m) => m.role === "user")?.content ?? "";
        const content = await recordingCaller(String(sys), String(usr));
        return {
          content,
          provider: selection.provider,
          model: selection.model,
        };
      },
    };
    const agenticStart = Date.now();
    const agentic = await runAgenticAnalysis(
      recordingClient as never,
      context,
      {
        onProgress: (framework, status, detail) =>
          console.log(
            `[${((Date.now() - agenticStart) / 1000).toFixed(0)}s] [agentic:${framework}] ${status} ${detail ?? ""}`,
          ),
      },
    );
    console.log("\n--- Agentic recording complete ---");
    console.log(`Threats: ${agentic.summary.totalThreats}`);
    console.log(`Frameworks: ${agentic.summary.frameworksUsed.join(", ")}`);
    console.log(`Verify loops: ${agentic.summary.verificationLoops}`);
  }

  console.log(`\nJournal: ${JOURNAL_PATH}`);
}

// Only run when executed directly (not when imported for unit tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Recording failed:", err);
    process.exit(1);
  });
}
