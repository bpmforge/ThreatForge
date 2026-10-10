/**
 * Stage-boundary cache unit tests
 *
 * Covers the key scheme + versioning + the gzip round-trip + 48 h TTL against a
 * fake ioredis, plus the fail-open contract (no Redis → null/no-op so the
 * caller falls through to normal execution). The real-Redis resume proof lives
 * in stage-cache.integration.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gunzipSync } from "node:zlib";

// --- Fake ioredis: an in-memory store that records set() args so we can assert
// the value is gzipped and the TTL is the 48 h EX. ---
const store = new Map<string, Buffer>();
const setCalls: Array<{ key: string; value: Buffer; ex?: number }> = [];

class FakeRedis {
  constructor(
    public url: string,
    public opts: unknown,
  ) {}
  on(): this {
    return this;
  }
  async getBuffer(key: string): Promise<Buffer | null> {
    return store.get(key) ?? null;
  }
  async set(
    key: string,
    value: Buffer,
    _mode?: string,
    ex?: number,
  ): Promise<"OK"> {
    setCalls.push({ key, value, ex });
    store.set(key, value);
    return "OK";
  }
  async quit(): Promise<"OK"> {
    return "OK";
  }
  disconnect(): void {}
}

vi.mock("ioredis", () => ({ Redis: FakeRedis, default: FakeRedis }));

// Import AFTER the mock is registered.
const {
  cacheKeyVersion,
  stageCacheKey,
  unitKeyFor,
  initStageCache,
  isStageCacheReady,
  getCachedStage,
  setCachedStage,
  closeStageCache,
  STAGE_CACHE_TTL_SECONDS,
} = await import("./stage-cache.js");

describe("stage-cache key scheme + versioning", () => {
  it("builds stage keys as tfsc:{version}:stage:{executionId}:{stageName}", () => {
    expect(stageCacheKey("exec-1", "ThreatIdentifier")).toBe(
      `tfsc:${cacheKeyVersion}:stage:exec-1:ThreatIdentifier`,
    );
  });

  it("appends the unit key for fan-out units", () => {
    expect(
      stageCacheKey("exec-1", "ThreatIdentifier", unitKeyFor("comp-9", "S")),
    ).toBe(`tfsc:${cacheKeyVersion}:stage:exec-1:ThreatIdentifier:comp-9::S`);
  });

  it("bumping cacheKeyVersion would change every key (version is in the key)", () => {
    expect(stageCacheKey("e", "Verifier")).toContain(`:${cacheKeyVersion}:`);
  });

  it("48 h TTL is exposed as 172800 seconds", () => {
    expect(STAGE_CACHE_TTL_SECONDS).toBe(48 * 60 * 60);
  });
});

describe("stage-cache fail-open without Redis", () => {
  beforeEach(async () => {
    await closeStageCache();
  });

  it("reads null and writes are no-ops before init (caller falls through)", async () => {
    expect(isStageCacheReady()).toBe(false);
    await expect(getCachedStage(stageCacheKey("x", "Y"))).resolves.toBeNull();
    // Must not throw — best-effort write.
    await expect(
      setCachedStage(stageCacheKey("x", "Y"), {
        outputs: { a: 1 },
        tokensUsed: 0,
        parseFailures: [],
      }),
    ).resolves.toBeUndefined();
  });
});

describe("stage-cache gzip round-trip + TTL (fake Redis)", () => {
  beforeEach(async () => {
    store.clear();
    setCalls.length = 0;
    await closeStageCache();
    initStageCache("redis://fake:6379");
  });

  afterEach(async () => {
    await closeStageCache();
  });

  it("stores a gzipped JSON value with the 48 h EX TTL and reads it back", async () => {
    const key = stageCacheKey("exec-7", "ArchitectureReader");
    const value = {
      outputs: { componentContexts: [{ id: "c1" }], methodology: "STRIDE" },
      tokensUsed: 123,
      parseFailures: [],
    };

    await setCachedStage(key, value);

    // The persisted bytes are gzip (magic 0x1f 0x8b) and the TTL is 48 h.
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].key).toBe(key);
    expect(setCalls[0].ex).toBe(STAGE_CACHE_TTL_SECONDS);
    expect(setCalls[0].value[0]).toBe(0x1f);
    expect(setCalls[0].value[1]).toBe(0x8b);
    expect(JSON.parse(gunzipSync(setCalls[0].value).toString("utf8"))).toEqual(
      value,
    );

    // Round-trips through getCachedStage.
    await expect(getCachedStage(key)).resolves.toEqual(value);
  });

  it("returns null on a miss", async () => {
    await expect(
      getCachedStage(stageCacheKey("nope", "Verifier")),
    ).resolves.toBeNull();
  });

  it("returns null (not throw) on a corrupt (non-gzip) value", async () => {
    const key = stageCacheKey("exec-bad", "Verifier");
    store.set(key, Buffer.from("not gzip", "utf8"));
    await expect(getCachedStage(key)).resolves.toBeNull();
  });
});
