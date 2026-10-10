/**
 * AI-SPEND — estimated USD cost of one completion, from its token usage.
 *
 * Prices are list rates in USD per million tokens. Model ids are matched by
 * substring, first match wins, so dated ids (`claude-sonnet-4-5-20250929`)
 * resolve to their family row. Anthropic rows come from Anthropic's published
 * price table (2026-09); OpenAI and Gemini rows are estimates of their list
 * prices and should be revisited when those change.
 *
 * Self-hosted endpoints cost $0: the lmstudio/ollama providers, and any
 * provider pointed at a local/LAN base URL (an OpenAI-compatible server).
 * Tokens are still recorded for them.
 *
 * An unknown model on a hosted provider is priced at that provider's most
 * expensive row, never at $0 — a $0 fallback would silently disable the spend
 * cap for every model not listed here.
 */
import logger from "../../../utils/logger.js";
import { isLocalEndpoint } from "./inflight-limiter.js";

export interface ModelPrice {
  inputPerMillion: number;
  outputPerMillion: number;
}

interface PriceRow extends ModelPrice {
  match: string;
}

const CLAUDE: PriceRow[] = [
  { match: "fable", inputPerMillion: 10, outputPerMillion: 50 },
  { match: "mythos", inputPerMillion: 10, outputPerMillion: 50 },
  { match: "opus-5-5", inputPerMillion: 4, outputPerMillion: 20 },
  { match: "opus-5", inputPerMillion: 5, outputPerMillion: 25 },
  { match: "opus-4-8", inputPerMillion: 5, outputPerMillion: 25 },
  { match: "opus-4-7", inputPerMillion: 5, outputPerMillion: 25 },
  { match: "opus-4-6", inputPerMillion: 5, outputPerMillion: 25 },
  { match: "opus-4-5", inputPerMillion: 5, outputPerMillion: 25 },
  // Opus 4 / 4.1 / 3 (legacy list price).
  { match: "opus", inputPerMillion: 15, outputPerMillion: 75 },
  { match: "sonnet-5", inputPerMillion: 2, outputPerMillion: 10 },
  { match: "sonnet", inputPerMillion: 3, outputPerMillion: 15 },
  { match: "haiku-4", inputPerMillion: 1, outputPerMillion: 5 },
  { match: "3-5-haiku", inputPerMillion: 0.8, outputPerMillion: 4 },
  { match: "haiku", inputPerMillion: 0.25, outputPerMillion: 1.25 },
];

const OPENAI: PriceRow[] = [
  { match: "gpt-4o-mini", inputPerMillion: 0.15, outputPerMillion: 0.6 },
  { match: "gpt-4o", inputPerMillion: 2.5, outputPerMillion: 10 },
  { match: "gpt-4.1-nano", inputPerMillion: 0.1, outputPerMillion: 0.4 },
  { match: "gpt-4.1-mini", inputPerMillion: 0.4, outputPerMillion: 1.6 },
  { match: "gpt-4.1", inputPerMillion: 2, outputPerMillion: 8 },
  { match: "gpt-5-nano", inputPerMillion: 0.05, outputPerMillion: 0.4 },
  { match: "gpt-5-mini", inputPerMillion: 0.25, outputPerMillion: 2 },
  { match: "gpt-5", inputPerMillion: 1.25, outputPerMillion: 10 },
  { match: "o4-mini", inputPerMillion: 1.1, outputPerMillion: 4.4 },
  { match: "o3-mini", inputPerMillion: 1.1, outputPerMillion: 4.4 },
  { match: "o3", inputPerMillion: 2, outputPerMillion: 8 },
  { match: "gpt-4-turbo", inputPerMillion: 10, outputPerMillion: 30 },
  { match: "gpt-4", inputPerMillion: 30, outputPerMillion: 60 },
];

const GEMINI: PriceRow[] = [
  { match: "flash-lite", inputPerMillion: 0.1, outputPerMillion: 0.4 },
  { match: "2.5-flash", inputPerMillion: 0.3, outputPerMillion: 2.5 },
  { match: "flash", inputPerMillion: 0.1, outputPerMillion: 0.4 },
  { match: "2.5-pro", inputPerMillion: 1.25, outputPerMillion: 10 },
  { match: "pro", inputPerMillion: 1.25, outputPerMillion: 10 },
];

const TABLES: Record<string, PriceRow[]> = {
  claude: CLAUDE,
  openai: OPENAI,
  gemini: GEMINI,
  vertexai: GEMINI,
};

const ALL_ROWS: PriceRow[] = [...CLAUDE, ...OPENAI, ...GEMINI];

const SELF_HOSTED = new Set(["lmstudio", "ollama"]);

const FREE: ModelPrice = { inputPerMillion: 0, outputPerMillion: 0 };

function mostExpensive(rows: PriceRow[]): ModelPrice {
  return rows.reduce((max, r) =>
    r.inputPerMillion + r.outputPerMillion >
    max.inputPerMillion + max.outputPerMillion
      ? r
      : max,
  );
}

const warnedUnknown = new Set<string>();

/** Per-million prices for one provider/model/endpoint. */
export function priceFor(
  provider: string,
  model: string | undefined,
  baseUrl: string | undefined,
): ModelPrice {
  if (SELF_HOSTED.has(provider) || isLocalEndpoint(baseUrl)) return FREE;
  const rows = TABLES[provider];
  if (!rows) return FREE; // no hosted provider of this kind exists
  const id = (model ?? "").toLowerCase();
  // A proxy such as OpenRouter is configured as "openai" but serves other
  // vendors' models (`anthropic/claude-sonnet-4-5`), so try every vendor's
  // rows before falling back to the ceiling.
  const row = id
    ? (rows.find((r) => id.includes(r.match)) ??
      ALL_ROWS.find((r) => id.includes(r.match)))
    : undefined;
  if (row) return row;
  const key = `${provider}:${id}`;
  if (!warnedUnknown.has(key)) {
    warnedUnknown.add(key);
    logger.warn(
      { provider, model },
      "No price listed for this model — estimating spend at the provider's highest rate",
    );
  }
  return mostExpensive(rows);
}

/** Estimated USD cost of one completion. */
export function estimateCostUsd(
  price: ModelPrice,
  promptTokens: number,
  completionTokens: number,
): number {
  return (
    (promptTokens * price.inputPerMillion +
      completionTokens * price.outputPerMillion) /
    1_000_000
  );
}
