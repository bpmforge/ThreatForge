/**
 * Collaboration Persistence Service
 *
 * Saves and loads Yjs document state to/from the database.
 * Supports Redis for horizontal scaling when REDIS_URL is configured.
 */
import * as Y from "yjs";
import logger from "../utils/logger.js";
import { getPrisma } from "../db.js";
import { getOrCreateDoc, getDocState, applyDocState } from "./collaboration.js";
import {
  isRedisEnabled,
  saveDocumentState as redisSaveDocumentState,
  loadDocumentState as redisLoadDocumentState,
  subscribeToUpdates,
  unsubscribeFromUpdates,
  registerSession,
  unregisterSession,
} from "./redis-collaboration.js";

/** Remove duplicate items by their `id` field, keeping first occurrence. */
function dedupById(items: unknown[]): unknown[] {
  const seen = new Set<unknown>();
  return items.filter((item) => {
    const id = (item as Record<string, unknown>).id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Debounce timers for saving */
const saveTimers = new Map<string, NodeJS.Timeout>();
const SAVE_DEBOUNCE_MS = 2000;

/**
 * Load collaboration state from Redis (if available) or database.
 */
async function loadCollaborationState(modelId: string): Promise<boolean> {
  try {
    // Try Redis first for faster access and cross-instance sync
    if (isRedisEnabled()) {
      const redisState = await redisLoadDocumentState(modelId);
      if (redisState) {
        applyDocState(modelId, redisState);
        logger.info(`Loaded collaboration state from Redis for ${modelId}`);
        return true;
      }
    }

    // Fall back to database
    const prisma = await getPrisma();
    const model = await prisma.threatModel.findUnique({
      where: { id: modelId },
      select: { collaborationState: true },
    });

    if (model?.collaborationState) {
      const state = Buffer.from(model.collaborationState, "base64");
      try {
        applyDocState(modelId, new Uint8Array(state));
      } catch (decodeErr) {
        // Stored state is corrupted — clear it so next connect rebuilds from canvasState.
        logger.warn(
          { err: decodeErr, modelId },
          "Corrupt collaborationState detected — clearing and rebuilding from canvasState",
        );
        const prisma2 = await getPrisma();
        await prisma2.threatModel.update({
          where: { id: modelId },
          data: { collaborationState: null },
        });
        return false;
      }

      // Sync to Redis for other instances
      if (isRedisEnabled()) {
        const doc = getOrCreateDoc(modelId);
        await redisSaveDocumentState(modelId, doc.doc);
      }

      return true;
    }
    return false;
  } catch (error) {
    // Not a corrupt document: a DB or Redis failure. Falling back to the
    // (older) canvasState here would let the next save overwrite newer
    // collaborative edits, so the session must not start.
    logger.error(
      { err: error },
      `Failed to load collaboration state for ${modelId}`,
    );
    throw error;
  }
}

/**
 * Save collaboration state to database (debounced).
 */
export function saveCollaborationState(modelId: string): void {
  // Clear existing timer
  const existing = saveTimers.get(modelId);
  if (existing) clearTimeout(existing);

  // Set new debounced save
  const timer = setTimeout(() => {
    saveTimers.delete(modelId);
    saveCollaborationStateNow(modelId).catch((err) => {
      logger.error(
        { err },
        `Failed to save collaboration state for ${modelId}`,
      );
    });
  }, SAVE_DEBOUNCE_MS);

  saveTimers.set(modelId, timer);
}

/**
 * Save collaboration state immediately to both Redis and database.
 */
async function saveCollaborationStateNow(modelId: string): Promise<void> {
  const state = getDocState(modelId);
  if (!state) return;

  // Save to Redis for cross-instance sync
  if (isRedisEnabled()) {
    const doc = getOrCreateDoc(modelId);
    await redisSaveDocumentState(modelId, doc.doc);
  }

  // Always persist to database for durability
  const prisma = await getPrisma();
  const base64State = Buffer.from(state).toString("base64");

  await prisma.threatModel.update({
    where: { id: modelId },
    data: { collaborationState: base64State },
  });
}

/**
 * Initialize collaboration from canvasState (for first connection).
 */
export async function initCollaborationFromCanvas(
  modelId: string,
): Promise<void> {
  const prisma = await getPrisma();
  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    select: { canvasState: true, collaborationState: true },
  });

  if (!model) return;

  // If we have collaboration state, use that (falls through on corrupt state).
  if (model.collaborationState) {
    const loaded = await loadCollaborationState(modelId);
    if (loaded) return;
    // Corrupt state was cleared — fall through to rebuild from canvasState.
  }

  // Otherwise, initialize from canvasState. Unparseable canvas JSON must not
  // become an empty doc: the next save would write that over the model.
  let canvas: { nodes?: unknown[]; edges?: unknown[] };
  try {
    canvas = JSON.parse(model.canvasState);
  } catch (err) {
    throw new Error(
      `canvasState of model ${modelId} is not valid JSON; refusing to start an empty collaboration session`,
      { cause: err },
    );
  }
  const collabDoc = getOrCreateDoc(modelId);
  const { doc } = collabDoc;

  doc.transact(() => {
    const nodesArray = doc.getArray("nodes");
    const edgesArray = doc.getArray("edges");

    // Clear any stale in-memory state before seeding from the DB canvasState.
    // This handles the case where collaborationState was cleared externally
    // but the server process still holds an old in-memory Yjs doc.
    nodesArray.delete(0, nodesArray.length);
    edgesArray.delete(0, edgesArray.length);

    dedupById(canvas.nodes ?? []).forEach((node) => nodesArray.push([node]));
    dedupById(canvas.edges ?? []).forEach((edge) => edgesArray.push([edge]));
  });
}

/**
 * Register a user session for horizontal scaling.
 * Should be called when a user joins a collaboration session.
 */
export async function registerCollaborationSession(
  modelId: string,
  userId: string,
  userName: string,
): Promise<void> {
  if (!isRedisEnabled()) return;

  await registerSession(modelId, userId, userName);

  // Subscribe to updates from other servers
  await subscribeToUpdates(modelId, (update, _origin) => {
    // Apply updates from other servers to local Yjs doc
    const collabDoc = getOrCreateDoc(modelId);
    Y.applyUpdate(collabDoc.doc, update);
  });
}

/**
 * Unregister a user session.
 * Should be called when a user leaves a collaboration session.
 */
export async function unregisterCollaborationSession(
  modelId: string,
  userId: string,
): Promise<void> {
  if (!isRedisEnabled()) return;

  await unregisterSession(modelId, userId);
  await unsubscribeFromUpdates(modelId);
}
