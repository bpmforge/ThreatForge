/**
 * Replay AI Caller for the parity harness.
 *
 * Wraps the micro-analysis `AICallFn` (see
 * services/ai/micro-analysis/types.ts — `(systemPrompt, userPrompt) =>
 * Promise<string>`) with a record/replay journal so pipeline runs are
 * deterministic and network-free in tests.
 *
 * - record: delegates to a real caller, upserts `{ hash, prompt, response }`
 *   into the journal file after every call (hash = sha256 of the combined
 *   prompt). Crash-safe: each call rewrites the journal on disk.
 * - replay: looks up by hash; a miss throws `ReplayMiss` carrying the first
 *   200 characters of the prompt. Performs zero network I/O by construction.
 */
import type { GenerationStage } from "../../services/ai/generation-settings.js";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AICallFn } from "../../services/ai/micro-analysis/types.js";

/** Separator joining system + user prompts into the journal's `prompt`. */
export const PROMPT_SEPARATOR = "\n\n=== USER PROMPT ===\n\n";

export interface JournalEntry {
  hash: string;
  prompt: string;
  response: string;
}

export class ReplayMiss extends Error {
  readonly promptPreview: string;

  constructor(prompt: string) {
    const preview = prompt.slice(0, 200);
    super(`ReplayMiss: no journal entry for prompt: ${preview}`);
    this.name = "ReplayMiss";
    this.promptPreview = preview;
  }
}

/** sha256 hex of the combined system + user prompt. */
export function hashPrompt(systemPrompt: string, userPrompt: string): string {
  return createHash("sha256")
    .update(systemPrompt + PROMPT_SEPARATOR + userPrompt)
    .digest("hex");
}

export function loadJournal(journalPath: string): JournalEntry[] {
  if (!existsSync(journalPath)) return [];
  const raw = readFileSync(journalPath, "utf8").trim();
  if (raw === "") return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Journal at ${journalPath} is not a JSON array`);
  }
  return parsed as JournalEntry[];
}

function saveJournal(journalPath: string, entries: JournalEntry[]): void {
  mkdirSync(dirname(journalPath), { recursive: true });
  writeFileSync(journalPath, JSON.stringify(entries, null, 2) + "\n", "utf8");
}

/**
 * Create an `AICallFn` that records to / replays from a JSON journal.
 *
 * @param journalPath — path to the journal JSON file
 * @param mode — "record" wraps `realCaller` and persists each exchange;
 *               "replay" serves responses from the journal with zero network
 * @param realCaller — required in record mode; ignored in replay mode
 */
export function createReplayAICaller(
  journalPath: string,
  mode: "record" | "replay",
  realCaller?: AICallFn,
): AICallFn {
  if (mode === "record") {
    if (!realCaller) {
      throw new Error("record mode requires a real AICallFn to wrap");
    }
    // Forward the stage so the real caller applies its
    // generation-settings row (thinking, max_tokens) while recording.
    return async (
      systemPrompt: string,
      userPrompt: string,
      stage?: GenerationStage,
    ) => {
      const response = await realCaller(systemPrompt, userPrompt, stage);
      const hash = hashPrompt(systemPrompt, userPrompt);
      // Re-read on every call so concurrent appends within one process and
      // partial runs both keep prior entries; upsert by hash.
      const entries = loadJournal(journalPath);
      const existing = entries.find((e) => e.hash === hash);
      if (existing) {
        existing.response = response;
      } else {
        entries.push({
          hash,
          prompt: systemPrompt + PROMPT_SEPARATOR + userPrompt,
          response,
        });
      }
      saveJournal(journalPath, entries);
      return response;
    };
  }

  // replay — load once; lookups are pure Map reads (no I/O, no network).
  const byHash = new Map<string, string>(
    loadJournal(journalPath).map((e) => [e.hash, e.response]),
  );
  return async (systemPrompt: string, userPrompt: string) => {
    const hash = hashPrompt(systemPrompt, userPrompt);
    const response = byHash.get(hash);
    if (response === undefined) {
      throw new ReplayMiss(systemPrompt + PROMPT_SEPARATOR + userPrompt);
    }
    return response;
  };
}
