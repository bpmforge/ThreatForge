/**
 * Replay AI Caller tests.
 *
 * Proves:
 * - replay mode performs ZERO network calls (fetch spy asserts 0 invocations)
 * - ReplayMiss is thrown on unknown prompts (with a 200-char prompt preview)
 * - record mode delegates to the real caller and persists journal entries
 * - record → replay round-trips
 * - the committed go-forward journal file is structurally valid
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createReplayAICaller,
  hashPrompt,
  loadJournal,
  ReplayMiss,
  PROMPT_SEPARATOR,
  type JournalEntry,
} from "./replay-ai.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let tmpDir: string;
let journalPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "replay-ai-"));
  journalPath = join(tmpDir, "journal.json");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function seedJournal(entries: JournalEntry[]): void {
  writeFileSync(journalPath, JSON.stringify(entries, null, 2), "utf8");
}

describe("createReplayAICaller — replay mode", () => {
  it("serves recorded responses with zero network calls", async () => {
    seedJournal([
      {
        hash: hashPrompt("sys", "user"),
        prompt: "sys" + PROMPT_SEPARATOR + "user",
        response: "recorded response",
      },
    ]);
    // Spy on the only network transport available to the helper. If replay
    // ever touched the network it would have to go through fetch.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network use is forbidden in replay mode"));

    const aiCall = createReplayAICaller(journalPath, "replay");
    const result = await aiCall("sys", "user");

    expect(result).toBe("recorded response");
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it("record mode forwards the stage to the real caller", async () => {
    const seen: Array<string | undefined> = [];
    const caller = createReplayAICaller(
      journalPath,
      "record",
      async (_s, _u, stage) => {
        seen.push(stage);
        return "ok";
      },
    );
    await caller("sys", "user", "mitigation");
    await caller("sys", "user2");
    expect(seen).toEqual(["mitigation", undefined]);
  });

  it("throws ReplayMiss on an unknown prompt", async () => {
    seedJournal([]);
    const aiCall = createReplayAICaller(journalPath, "replay");

    await expect(aiCall("unknown sys", "unknown user")).rejects.toThrow(
      ReplayMiss,
    );
  });

  it("ReplayMiss message carries the first 200 chars of the prompt", async () => {
    seedJournal([]);
    const aiCall = createReplayAICaller(journalPath, "replay");
    const longSystem = "S".repeat(500);

    const err = await aiCall(longSystem, "user").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ReplayMiss);
    const miss = err as ReplayMiss;
    expect(miss.promptPreview).toHaveLength(200);
    expect(miss.promptPreview).toBe(
      (longSystem + PROMPT_SEPARATOR + "user").slice(0, 200),
    );
    expect(miss.message).toContain(miss.promptPreview);
  });

  it("treats a missing journal file as empty (all prompts miss)", async () => {
    const aiCall = createReplayAICaller(
      join(tmpDir, "does-not-exist.json"),
      "replay",
    );
    await expect(aiCall("a", "b")).rejects.toThrow(ReplayMiss);
  });
});

describe("createReplayAICaller — record mode", () => {
  it("requires a real caller to wrap", () => {
    expect(() => createReplayAICaller(journalPath, "record")).toThrow(
      /record mode requires/,
    );
  });

  it("delegates to the real caller and writes {hash, prompt, response}", async () => {
    const real = vi.fn(
      async (sys: string, user: string) => `echo:${sys}|${user}`,
    );
    const aiCall = createReplayAICaller(journalPath, "record", real);

    const result = await aiCall("system A", "user A");

    expect(result).toBe("echo:system A|user A");
    expect(real).toHaveBeenCalledExactlyOnceWith(
      "system A",
      "user A",
      undefined,
    );

    const entries = JSON.parse(
      readFileSync(journalPath, "utf8"),
    ) as JournalEntry[];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      hash: hashPrompt("system A", "user A"),
      prompt: "system A" + PROMPT_SEPARATOR + "user A",
      response: "echo:system A|user A",
    });
    // sha256 hex
    expect(entries[0].hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("upserts by hash instead of duplicating identical prompts", async () => {
    let n = 0;
    const real = vi.fn(async () => `response-${++n}`);
    const aiCall = createReplayAICaller(journalPath, "record", real);

    await aiCall("sys", "same prompt");
    await aiCall("sys", "same prompt");
    await aiCall("sys", "different prompt");

    const entries = loadJournal(journalPath);
    expect(entries).toHaveLength(2);
    const samePromptEntry = entries.find(
      (e) => e.hash === hashPrompt("sys", "same prompt"),
    );
    expect(samePromptEntry?.response).toBe("response-2");
  });

  it("record → replay round-trips with zero network", async () => {
    const real = vi.fn(
      async (_sys: string, user: string) => `answer for ${user}`,
    );
    const recorder = createReplayAICaller(journalPath, "record", real);
    await recorder("sys", "q1");
    await recorder("sys", "q2");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("no network in replay"));
    const replayer = createReplayAICaller(journalPath, "replay");

    expect(await replayer("sys", "q1")).toBe("answer for q1");
    expect(await replayer("sys", "q2")).toBe("answer for q2");
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });
});

describe("committed go-forward journal", () => {
  it("is a structurally valid journal", () => {
    const committedPath = resolve(
      __dirname,
      "../fixtures/go-forward/llm-journal.json",
    );
    const entries = loadJournal(committedPath);
    expect(Array.isArray(entries)).toBe(true);
    for (const entry of entries) {
      expect(entry.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(typeof entry.prompt).toBe("string");
      expect(typeof entry.response).toBe("string");
      expect(
        hashPrompt(
          ...(entry.prompt.split(PROMPT_SEPARATOR) as [string, string]),
        ),
      ).toBe(entry.hash);
    }
  });
});
