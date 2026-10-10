/**
 * Stage-boundary Redis cache.
 *
 * Stage outputs are cached in Redis keyed
 *   stage:{executionId}:{stageName}[:{unitKey}]
 * (unitKey present for fan-out units, e.g. ThreatIdentifier children keyed by
 * `${componentId}::${category}`). Value is gzipped JSON of a `CachedStage`.
 * TTL is 48 h. On resume — a re-enqueued job that reuses the SAME executionId
 * (persisted in `AiJob.checkpoint.executionId`) — completed stages and
 * completed fan-out children are served from the cache instead of re-executing,
 * so no tokens are spent on already-finished work.
 *
 * STATUS: the read side is live but nothing WRITES — no caller sets
 * `resumeExecutionId`, so pipeline-service / ai-flow stopped calling
 * `setCachedStage` rather than fill Redis with payloads nothing reads. A
 * resume caller must re-enable the writes (see pipeline-service.ts).
 *
 * INVARIANTS:
 * - The cache is a pure OPTIMIZATION. Every read fails OPEN: a miss, a missing
 *   Redis connection, a decode error, or any thrown error returns `null`/no-op
 *   so the caller falls through to normal execution. It is NEVER a hard
 *   dependency — a cold cache produces a byte-identical run, just slower.
 * - Reuses the ai-queue Redis URL (set via `initStageCache`, called from
 *   `initAiQueue`). Opens its own ioredis client lazily because BullMQ does not
 *   expose a raw command client; closing it is idempotent (tests + shutdown).
 * - Keys are namespaced by `cacheKeyVersion`. Bumping the constant invalidates
 *   every prior entry without touching Redis (old keys simply expire by TTL).
 */
import { gunzipSync, gzipSync } from "node:zlib";
import type { Redis } from "ioredis";
import type { ParseFailure } from "../micro-analysis/types.js";

/**
 * Cache schema version. BUMP THIS to invalidate all stage caches (e.g. after a
 * change to stage output shape or aggregation semantics). Old keys then live
 * only until their 48 h TTL expires and are never read again.
 */
export const cacheKeyVersion = "v1";

/** Key prefix — `tfsc` = ThreatForge Stage Cache. */
const KEY_PREFIX = "tfsc";

/** 48 hours, in seconds (Redis EX unit). */
export const STAGE_CACHE_TTL_SECONDS = 48 * 60 * 60;

/**
 * Cached stage payload — the handler-level result the pipeline executor and the
 * fan-out children need to reconstruct a stage outcome without re-running it.
 */
export interface CachedStage {
  outputs: Record<string, unknown>;
  tokensUsed: number;
  parseFailures: ParseFailure[];
}

let _redisUrl: string | null = null;
let _client: Redis | null = null;

/**
 * Build the cache key for a stage (or a fan-out unit when `unitKey` is given).
 *   tfsc:v1:stage:{executionId}:{stageName}[:{unitKey}]
 */
export function stageCacheKey(
  executionId: string,
  stageName: string,
  unitKey?: string,
): string {
  const base = `${KEY_PREFIX}:${cacheKeyVersion}:stage:${executionId}:${stageName}`;
  return unitKey ? `${base}:${unitKey}` : base;
}

/** The fan-out unit key for a (componentId, category) pair. */
export function unitKeyFor(componentId: string, category: string): string {
  return `${componentId}::${category}`;
}

/**
 * Register the Redis URL (same URL ai-queue/ai-flow use). Call once at startup
 * from `initAiQueue`, or from an integration test. Without it the cache is a
 * no-op and every run falls through to normal execution.
 */
export function initStageCache(redisUrl: string): void {
  _redisUrl = redisUrl;
}

/** True when a Redis URL has been registered (caching is possible). */
export function isStageCacheReady(): boolean {
  return _redisUrl !== null;
}

async function getClient(): Promise<Redis | null> {
  if (!_redisUrl) return null;
  if (_client) return _client;
  try {
    const { Redis } = await import("ioredis");
    const client = new Redis(_redisUrl, {
      // Fail fast: the cache must never block the pipeline. A read that cannot
      // reach Redis returns null and the caller executes the stage normally.
      // `enableOfflineQueue` is left ON so the first commands issued before the
      // socket is `ready` buffer briefly instead of erroring; a genuinely dead
      // Redis still fails fast (maxRetriesPerRequest:1 + null retryStrategy) and
      // both read and write paths swallow the rejection (fail-open).
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    // ioredis emits 'error' asynchronously; swallow so a dead Redis never
    // crashes the process — reads/writes already fail open below.
    client.on("error", () => undefined);
    _client = client;
    return client;
  } catch {
    return null;
  }
}

/**
 * Read a cached stage result. Returns `null` on miss, no Redis, or any error
 * (fail-open — caller falls through to normal execution).
 */
export async function getCachedStage(key: string): Promise<CachedStage | null> {
  const client = await getClient();
  if (!client) return null;
  try {
    const raw = await client.getBuffer(key);
    if (!raw) return null;
    const json = gunzipSync(raw).toString("utf8");
    return JSON.parse(json) as CachedStage;
  } catch {
    return null;
  }
}

/**
 * Write a stage result to the cache with the 48 h TTL. Best-effort: a write
 * failure is swallowed (the run already produced the result; the cache just
 * won't help a future resume of this key).
 */
export async function setCachedStage(
  key: string,
  value: CachedStage,
): Promise<void> {
  const client = await getClient();
  if (!client) return;
  try {
    const packed = gzipSync(Buffer.from(JSON.stringify(value), "utf8"));
    await client.set(key, packed, "EX", STAGE_CACHE_TTL_SECONDS);
  } catch {
    // Fail-open: never let a cache write break the pipeline.
  }
}

/** Idempotent teardown (server shutdown + integration tests). */
export async function closeStageCache(): Promise<void> {
  const client = _client;
  _client = null;
  _redisUrl = null;
  if (client) {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}
