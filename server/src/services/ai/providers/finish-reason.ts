/**
 * Normalise each provider's stop signal to 'stop' | 'length' | 'other'.
 * Missing in = `undefined` out (the provider did not report one).
 */
import type { AICompletionResponse, FinishReason } from "../../../types/ai.js";
import logger from "../../../utils/logger.js";

const LENGTH = new Set(["length", "max_tokens", "MAX_TOKENS"]);
const STOP = new Set(["stop", "end_turn", "stop_sequence", "STOP"]);

export function normalizeFinishReason(
  raw: string | null | undefined,
): FinishReason | undefined {
  if (!raw) return undefined;
  if (LENGTH.has(raw)) return "length";
  if (STOP.has(raw)) return "stop";
  return "other";
}

/**
 * A reply cut off at the max-tokens cap parses as a complete-looking but
 * partial list. Surface it. Returns true when the reply was truncated.
 */
export function warnIfTruncated(
  resp: Pick<AICompletionResponse, "finishReason" | "provider" | "model">,
  stage?: string,
): boolean {
  if (resp.finishReason !== "length") return false;
  logger.warn(
    { provider: resp.provider, model: resp.model, stage },
    "AI response truncated at max tokens (finish_reason=length); output may be partial",
  );
  return true;
}
