/**
 * Redis-backed Yjs Collaboration Service
 *
 * Enables horizontal scaling of the collaboration server by:
 * 1. Storing Yjs document state in Redis for persistence
 * 2. Using Redis pub/sub to broadcast updates across server instances
 * 3. Providing sticky session support via Redis-stored session metadata
 *
 * This service works alongside the in-memory collaboration service,
 * adding cross-instance synchronization when REDIS_URL is configured.
 */
import { Redis } from "ioredis";
import * as Y from "yjs";
import logger from "../utils/logger.js";

// Redis key prefixes
const KEY_PREFIX = "flowthreat:collab:";
const DOC_KEY = (modelId: string) => `${KEY_PREFIX}doc:${modelId}`;
const SESSION_KEY = (modelId: string) => `${KEY_PREFIX}sessions:${modelId}`;
const LOCK_KEY = (modelId: string) => `${KEY_PREFIX}lock:${modelId}`;
const CHANNEL_PREFIX = "flowthreat:collab:updates:";

// TTL for keys (24 hours)
const KEY_TTL_SECONDS = 86400;
// Lock TTL (5 seconds)
const LOCK_TTL_MS = 5000;

/** Session metadata stored in Redis */
interface SessionMetadata {
  serverId: string;
  userId: string;
  userName: string;
  connectedAt: string;
}

/** Redis collaboration state */
interface RedisCollaborationState {
  redis: Redis | null;
  redisSub: Redis | null;
  serverId: string;
  isConnected: boolean;
  updateHandlers: Map<string, (update: Uint8Array, origin: string) => void>;
}

/** Global state */
const state: RedisCollaborationState = {
  redis: null,
  redisSub: null,
  serverId: `server-${process.pid}-${Date.now()}`,
  isConnected: false,
  updateHandlers: new Map(),
};

/**
 * Initialize Redis connection for collaboration.
 * Call this at server startup if REDIS_URL is configured.
 */
export async function initializeRedisCollaboration(): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.info("Redis collaboration disabled: REDIS_URL not set");
    return false;
  }

  try {
    // Main connection for commands
    state.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    // Separate connection for pub/sub (required by Redis)
    state.redisSub = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    await state.redis.connect();
    await state.redisSub.connect();

    // Set up message handler for updates
    state.redisSub.on("messageBuffer", (channel: Buffer, message: Buffer) => {
      handleIncomingUpdate(channel, message);
    });

    state.isConnected = true;
    logger.info(`Redis collaboration initialized: serverId=${state.serverId}`);
    return true;
  } catch (error) {
    logger.error({ err: error }, "Failed to initialize Redis collaboration");
    await cleanupRedisConnections();
    return false;
  }
}

/**
 * Check if Redis collaboration is enabled and connected.
 */
export function isRedisEnabled(): boolean {
  return state.isConnected && state.redis !== null;
}

/**
 * Get the current server ID.
 */
export function getServerId(): string {
  return state.serverId;
}

/**
 * Save Yjs document state to Redis.
 */
export async function saveDocumentState(
  modelId: string,
  doc: Y.Doc,
): Promise<boolean> {
  if (!state.redis || !state.isConnected) return false;

  try {
    const update = Y.encodeStateAsUpdate(doc);
    const key = DOC_KEY(modelId);

    // Use a lock to prevent concurrent writes
    const lockKey = LOCK_KEY(modelId);
    const lockAcquired = await acquireLock(lockKey);

    if (!lockAcquired) {
      logger.warn(`Could not acquire lock for ${modelId}, skipping save`);
      return false;
    }

    try {
      await state.redis.set(key, Buffer.from(update), "EX", KEY_TTL_SECONDS);
      return true;
    } finally {
      await releaseLock(lockKey);
    }
  } catch (error) {
    logger.error(
      { err: error },
      `Failed to save document state for ${modelId}`,
    );
    return false;
  }
}

/**
 * Load Yjs document state from Redis.
 */
export async function loadDocumentState(
  modelId: string,
): Promise<Uint8Array | null> {
  if (!state.redis || !state.isConnected) return null;

  try {
    const key = DOC_KEY(modelId);
    const data = await state.redis.getBuffer(key);

    if (!data) return null;

    // Refresh TTL on access
    await state.redis.expire(key, KEY_TTL_SECONDS);

    return new Uint8Array(data);
  } catch (error) {
    logger.error(
      { err: error },
      `Failed to load document state for ${modelId}`,
    );
    return null;
  }
}

/**
 * Subscribe to updates for a document.
 * Updates from other servers will be passed to the handler.
 */
export async function subscribeToUpdates(
  modelId: string,
  handler: (update: Uint8Array, origin: string) => void,
): Promise<boolean> {
  if (!state.redisSub || !state.isConnected) return false;

  try {
    const channel = `${CHANNEL_PREFIX}${modelId}`;
    state.updateHandlers.set(modelId, handler);
    await state.redisSub.subscribe(channel);
    return true;
  } catch (error) {
    logger.error(
      { err: error },
      `Failed to subscribe to updates for ${modelId}`,
    );
    return false;
  }
}

/**
 * Unsubscribe from updates for a document.
 */
export async function unsubscribeFromUpdates(modelId: string): Promise<void> {
  if (!state.redisSub || !state.isConnected) return;

  try {
    const channel = `${CHANNEL_PREFIX}${modelId}`;
    state.updateHandlers.delete(modelId);
    await state.redisSub.unsubscribe(channel);
  } catch (error) {
    logger.error(
      { err: error },
      `Failed to unsubscribe from updates for ${modelId}`,
    );
  }
}

/**
 * Register a session for sticky session routing.
 */
export async function registerSession(
  modelId: string,
  userId: string,
  userName: string,
): Promise<boolean> {
  if (!state.redis || !state.isConnected) return false;

  try {
    const key = SESSION_KEY(modelId);
    const sessionData: SessionMetadata = {
      serverId: state.serverId,
      userId,
      userName,
      connectedAt: new Date().toISOString(),
    };

    await state.redis.hset(key, `${userId}`, JSON.stringify(sessionData));
    await state.redis.expire(key, KEY_TTL_SECONDS);
    return true;
  } catch (error) {
    logger.error(
      { err: error },
      `Failed to register session for ${modelId}:${userId}`,
    );
    return false;
  }
}

/**
 * Unregister a session.
 */
export async function unregisterSession(
  modelId: string,
  userId: string,
): Promise<void> {
  if (!state.redis || !state.isConnected) return;

  try {
    const key = SESSION_KEY(modelId);
    await state.redis.hdel(key, `${userId}`);
  } catch (error) {
    logger.error(
      { err: error },
      `Failed to unregister session for ${modelId}:${userId}`,
    );
  }
}

/**
 * Get the server ID that should handle a model.
 * Returns null if no sessions exist (any server can handle it).
 */
export async function getPreferredServer(
  modelId: string,
): Promise<string | null> {
  if (!state.redis || !state.isConnected) return null;

  try {
    const key = SESSION_KEY(modelId);
    const sessions = await state.redis.hvals(key);

    if (sessions.length === 0) return null;

    // Return the server with the most sessions
    const serverCounts = new Map<string, number>();
    for (const sessionJson of sessions) {
      const session: SessionMetadata = JSON.parse(sessionJson);
      serverCounts.set(
        session.serverId,
        (serverCounts.get(session.serverId) || 0) + 1,
      );
    }

    let preferredServer = null;
    let maxCount = 0;
    for (const [serverId, count] of serverCounts) {
      if (count > maxCount) {
        maxCount = count;
        preferredServer = serverId;
      }
    }

    return preferredServer;
  } catch (error) {
    logger.error(
      { err: error },
      `Failed to get preferred server for ${modelId}`,
    );
    return null;
  }
}

/**
 * Get active user counts for a list of model IDs.
 * Returns a map of modelId → count of currently connected users.
 * Falls back to empty map when Redis is unavailable.
 */
export async function getActiveUserCounts(
  modelIds: string[],
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (!state.redis || !state.isConnected || modelIds.length === 0)
    return result;

  try {
    const pipeline = state.redis.pipeline();
    for (const id of modelIds) {
      pipeline.hlen(SESSION_KEY(id));
    }
    const counts = await pipeline.exec();
    if (counts) {
      modelIds.forEach((id, i) => {
        const [err, count] = counts[i] ?? [null, 0];
        if (!err) result[id] = (count as number) ?? 0;
      });
    }
  } catch {
    // Redis unavailable — return empty (best-effort)
  }
  return result;
}

/**
 * Cleanup Redis connections on server shutdown.
 */
export async function cleanupRedisConnections(): Promise<void> {
  state.isConnected = false;

  if (state.redisSub) {
    try {
      await state.redisSub.quit();
    } catch {
      // best-effort — intentionally silent
    }
    state.redisSub = null;
  }

  if (state.redis) {
    try {
      await state.redis.quit();
    } catch {
      // best-effort — intentionally silent
    }
    state.redis = null;
  }

  state.updateHandlers.clear();
  logger.info("Redis collaboration connections closed");
}

// =============================================================================
// Private Helpers
// =============================================================================

/**
 * Handle incoming update from Redis pub/sub.
 */
function handleIncomingUpdate(
  channelBuffer: Buffer,
  messageBuffer: Buffer,
): void {
  const channel = channelBuffer.toString();
  const modelId = channel.replace(CHANNEL_PREFIX, "");

  // Parse the message to extract server ID and update
  const message = new Uint8Array(messageBuffer);
  const nullIndex = message.indexOf(0); // Find null separator

  if (nullIndex === -1) {
    logger.warn("Invalid update message format");
    return;
  }

  const originServerId = new TextDecoder().decode(message.slice(0, nullIndex));
  const update = message.slice(nullIndex + 1);

  // Ignore updates from our own server
  if (originServerId === state.serverId) {
    return;
  }

  // Call the handler if registered
  const handler = state.updateHandlers.get(modelId);
  if (handler) {
    handler(update, originServerId);
  }
}

/**
 * Acquire a distributed lock.
 */
async function acquireLock(lockKey: string): Promise<boolean> {
  if (!state.redis) return false;

  try {
    const result = await state.redis.set(
      lockKey,
      state.serverId,
      "PX",
      LOCK_TTL_MS,
      "NX",
    );
    return result === "OK";
  } catch {
    // best-effort — intentionally silent
    return false;
  }
}

/**
 * Release a distributed lock.
 */
async function releaseLock(lockKey: string): Promise<void> {
  if (!state.redis) return;

  try {
    // Only release if we own the lock
    const owner = await state.redis.get(lockKey);
    if (owner === state.serverId) {
      await state.redis.del(lockKey);
    }
  } catch {
    // best-effort — intentionally silent
  }
}
