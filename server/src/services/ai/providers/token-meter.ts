/**
 * Token accounting for a pipeline run.
 *
 * Every provider client already returns `usage` on its completion response,
 * but the pipeline talks to the model through `AICallFn`, which returns text
 * only, so the counts were dropped at every call site. A TokenMeter sits
 * where that AICallFn is built, keeps the usage of each response, and hands
 * the totals to the run summary.
 *
 * A response without `usage` still counts as a call (`callsWithoutUsage`), so
 * a provider that stops reporting tokens shows up as a gap, not as a cheaper
 * run.
 */
import {
  generationSettingsFor,
  type GenerationStage,
} from "../generation-settings.js";
import type {
  AIProviderClient,
  AICompletionResponse,
} from "../../../types/ai.js";
import type { AICallFn } from "../micro-analysis/types.js";
import logger from "../../../utils/logger.js";
import { warnIfTruncated } from "./finish-reason.js";

export interface TokenTotals {
  calls: number;
  callsWithoutUsage: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Largest single prompt in the run — the "largest prompt" figure in the run summary. */
  maxPromptTokens: number;
  /** Calls whose reply stopped at the max-tokens cap (possibly partial). */
  truncatedCalls: number;
}

export class TokenMeter {
  private t: TokenTotals = {
    calls: 0,
    callsWithoutUsage: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    maxPromptTokens: 0,
    truncatedCalls: 0,
  };

  record(
    usage: AICompletionResponse["usage"],
    finishReason?: AICompletionResponse["finishReason"],
  ): void {
    this.t.calls++;
    if (finishReason === "length") this.t.truncatedCalls++;
    if (!usage) {
      this.t.callsWithoutUsage++;
      return;
    }
    this.t.promptTokens += usage.promptTokens;
    this.t.completionTokens += usage.completionTokens;
    this.t.totalTokens += usage.totalTokens;
    this.t.maxPromptTokens = Math.max(
      this.t.maxPromptTokens,
      usage.promptTokens,
    );
  }

  totals(): TokenTotals {
    return { ...this.t };
  }
}

/**
 * The system + user AICallFn the micro pipeline uses, recording each
 * response's usage on `meter`. Same request shape the call sites built by
 * hand before (two messages, fixed temperature and max tokens).
 */
export function meteredAiCall(
  client: AIProviderClient,
  meter: TokenMeter,
  opts: { temperature: number; maxTokens: number },
): AICallFn {
  return async (system: string, user: string, stage?: GenerationStage) => {
    // A named stage uses its row of the generation-settings table;
    // unstaged calls keep the caller's defaults.
    const settings = generationSettingsFor(stage);
    const resp = await client.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: settings?.temperature ?? opts.temperature,
      maxTokens: settings?.maxTokens ?? opts.maxTokens,
      thinking: settings?.thinking,
    });
    meter.record(resp.usage, resp.finishReason);
    warnIfTruncated(resp, stage);
    logger.debug(
      {
        promptTokens: resp.usage?.promptTokens,
        completionTokens: resp.usage?.completionTokens,
      },
      "AI call tokens",
    );
    return resp.content;
  };
}
