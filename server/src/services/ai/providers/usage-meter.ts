/**
 * AI-SPEND — record token usage and estimated cost for every provider call.
 *
 * createAIClient wraps every client with this, so it is the one place each
 * completion passes through, whatever path issued it (legacy micro pipeline,
 * v2 stages, fan-out children, chat, extraction, routes). Each call is:
 *   1. recorded on aiMetrics for the org (synced to AIProvider.estimatedCost,
 *      which the spend guard and /usage read), and
 *   2. added to the active stage-usage scope, if any, so a v2 pipeline stage
 *      can report the tokens its calls used without threading counters
 *      through every stage handler.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type {
  AIProviderClient,
  AICompletionOptions,
  AICompletionResponse,
} from "../../../types/ai.js";
import { aiMetrics } from "../ai-metrics.js";
import { estimateCostUsd, priceFor } from "./pricing.js";
import { overrideClient } from "./override-client.js";

export interface UsageMeterContext {
  organizationId: string;
  model?: string;
  baseUrl?: string;
}

/** Token totals for the calls made inside one usage scope. */
export interface ScopedUsage {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

const scopes = new AsyncLocalStorage<ScopedUsage>();

/**
 * Run `fn` and return its result together with the token usage of every
 * metered provider call made inside it (across awaits and Promise.all).
 */
export async function withUsageScope<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; usage: ScopedUsage }> {
  const usage: ScopedUsage = {
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  const result = await scopes.run(usage, fn);
  return { result, usage };
}

/**
 * Wrap `client` so each `complete()` records its usage and estimated cost.
 * Every other member is passed through untouched.
 */
export function meterUsage(
  client: AIProviderClient,
  ctx: UsageMeterContext,
): AIProviderClient {
  const complete = async (
    options: AICompletionOptions,
  ): Promise<AICompletionResponse> => {
    const started = Date.now();
    let resp: AICompletionResponse;
    try {
      resp = await client.complete(options);
    } catch (err) {
      aiMetrics.recordRequest({
        organizationId: ctx.organizationId,
        provider: client.provider,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - started,
        estimatedCostUsd: 0,
        isError: true,
      });
      throw err;
    }
    const promptTokens = resp.usage?.promptTokens ?? 0;
    const completionTokens = resp.usage?.completionTokens ?? 0;
    const price = priceFor(
      client.provider,
      resp.model || ctx.model,
      ctx.baseUrl,
    );
    aiMetrics.recordRequest({
      organizationId: ctx.organizationId,
      provider: client.provider,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      latencyMs: Date.now() - started,
      estimatedCostUsd: estimateCostUsd(price, promptTokens, completionTokens),
    });
    const scope = scopes.getStore();
    if (scope) {
      scope.calls++;
      scope.promptTokens += promptTokens;
      scope.completionTokens += completionTokens;
      scope.totalTokens +=
        resp.usage?.totalTokens ?? promptTokens + completionTokens;
    }
    return resp;
  };
  return overrideClient(client, { complete });
}
