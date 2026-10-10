/**
 * Per-stage generation settings: one table, used by the app's metered
 * caller and by the recorder tooling.
 *
 * Extraction/identification stages run with thinking OFF and a max_tokens cap
 * sized from measured replies (ThinkingCap build, thinking off; token
 * ≈ 4 characters): cap ≈ 1.4 × the largest reply seen, so a normal answer is
 * never truncated but a runaway one stops early. Only the reviewer thinks.
 *
 * | Stage       | replies | p95   | max   |
 * |-------------|---------|-------|-------|
 * | category    | 381     | 804   | 1,014 |
 * | mitigation  | 60      | 2,121 | 2,410 | (batch of 3; single-threat p95 1,048)
 * | dedup       | 117     | 2,612 | 2,869 | (one reply hit a 3,500 cap, so the cap is 5,000)
 * | compound    | 9       | 1,148 | 1,170 |
 * | calibration | 9       | 1,358 | 4,112 |
 *
 * `analysis` = expert/agentic passes 1–4 (understand, flows, identify,
 * chains): thinking off. On the ThinkingCap build with thinking on, expert
 * pass 2 ran past the 280 s provider timeout; pass 1 alone wrote ~5.3k tokens,
 * so the cap is 8,000.
 */

export type GenerationStage =
  | "category"
  | "category-chunk"
  | "mitigation"
  | "dedup"
  | "compound"
  | "calibration"
  | "analysis"
  | "reviewer";

export interface GenerationSettings {
  /** Sent as `enable_thinking` by providers that support it (OpenAI-compatible). */
  thinking: boolean;
  maxTokens: number;
  /** Sampling temperature for this stage. */
  temperature: number;
}

/** The temperature used for every stage unless overridden. */
export const DEFAULT_TEMPERATURE = 0.3;

export const GENERATION_SETTINGS: Readonly<
  Record<GenerationStage, GenerationSettings>
> = {
  category: {
    thinking: false,
    maxTokens: 1500,
    temperature: DEFAULT_TEMPERATURE,
  },
  // A chunk of 3 categories = 3 × the single-category cap.
  "category-chunk": {
    thinking: false,
    maxTokens: 4500,
    temperature: DEFAULT_TEMPERATURE,
  },
  mitigation: {
    thinking: false,
    maxTokens: 3000,
    temperature: DEFAULT_TEMPERATURE,
  },
  dedup: { thinking: false, maxTokens: 5000, temperature: DEFAULT_TEMPERATURE },
  compound: {
    thinking: false,
    maxTokens: 2000,
    temperature: DEFAULT_TEMPERATURE,
  },
  calibration: {
    thinking: false,
    maxTokens: 5000,
    temperature: DEFAULT_TEMPERATURE,
  },
  analysis: {
    thinking: false,
    maxTokens: 8000,
    temperature: DEFAULT_TEMPERATURE,
  },
  reviewer: {
    thinking: true,
    maxTokens: 16000,
    temperature: DEFAULT_TEMPERATURE,
  },
};

/**
 * Settings for a stage, or `undefined` when the caller did not name one — the
 * call then keeps its caller's defaults (unchanged behaviour for unstaged calls).
 */
export function generationSettingsFor(
  stage: GenerationStage | undefined,
): GenerationSettings | undefined {
  return stage ? GENERATION_SETTINGS[stage] : undefined;
}
