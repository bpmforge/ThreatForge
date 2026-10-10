/**
 * Yjs Collaboration Service
 *
 * Manages real-time collaboration documents using Yjs.
 * Each threat model has its own Y.Doc that syncs across clients.
 *
 * Shared data structures:
 * - Y.Array('nodes') - Canvas nodes
 * - Y.Array('edges') - Canvas edges
 * - Y.Map('viewport') - Canvas viewport state
 * - Y.Map('threats') - Threats keyed by ID
 * - Y.Map('mitigations') - Mitigations keyed by ID
 */
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import type { WebSocket } from "ws";
import logger from "../utils/logger.js";

// Message types for Yjs protocol (must match y-websocket client constants)
// 0: messageSync, 1: messageAwareness, 2: messageAuth (y-websocket reserved), 3: messageQueryAwareness (y-websocket reserved)
const messageSync = 0;
const messageAwareness = 1;

/** Heartbeat interval (30 seconds) */
const HEARTBEAT_INTERVAL = 30000;

/** Connection timeout (2 minutes without heartbeat response) */
const CONNECTION_TIMEOUT = 120000;

/** Represents a connected client */
interface Client {
  socket: WebSocket;
  awareness: awarenessProtocol.Awareness;
  isAlive: boolean;
  heartbeatInterval?: NodeJS.Timeout;
  lastActivity: number;
  /** Read-only account: may sync the document down, never change it. */
  receiveOnly: boolean;
}

/** Represents a collaborative document (one per threat model) */
interface CollaborativeDoc {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<Client>;
}

/** Store of collaborative documents by model ID */
const docs = new Map<string, CollaborativeDoc>();

/** Callback for document updates (used by persistence) */
let onDocUpdate: ((modelId: string) => void) | null = null;

/** Set callback for document updates */
export function setDocUpdateCallback(
  callback: (modelId: string) => void,
): void {
  onDocUpdate = callback;
}

/**
 * Get or create a collaborative document for a threat model.
 */
export function getOrCreateDoc(modelId: string): CollaborativeDoc {
  let collabDoc = docs.get(modelId);

  if (!collabDoc) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);

    collabDoc = {
      doc,
      awareness,
      clients: new Set(),
    };

    docs.set(modelId, collabDoc);

    // Track document updates for persistence
    doc.on("update", () => {
      onDocUpdate?.(modelId);
    });

    // Clean up awareness when a client disconnects
    awareness.on("change", () => {
      // Broadcast awareness changes to all clients
      const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
        awareness,
        Array.from(awareness.getStates().keys()),
      );
      broadcastMessage(collabDoc!, messageAwareness, awarenessUpdate);
    });
  }

  return collabDoc;
}

/**
 * Handle a new WebSocket connection for a threat model.
 */
export function handleConnection(
  socket: WebSocket,
  modelId: string,
  userId: string,
  userName: string,
  { receiveOnly = false }: { receiveOnly?: boolean } = {},
): void {
  const collabDoc = getOrCreateDoc(modelId);
  const { doc, awareness } = collabDoc;

  const client: Client = {
    socket,
    awareness,
    isAlive: true,
    lastActivity: Date.now(),
    receiveOnly,
  };

  collabDoc.clients.add(client);

  // Set awareness state for this client
  awareness.setLocalStateField("user", {
    id: userId,
    name: userName,
    color: getRandomColor(),
  });

  // Set up heartbeat for connection keepalive
  client.heartbeatInterval = setInterval(() => {
    if (!client.isAlive) {
      // Client didn't respond to last ping, terminate connection
      logger.info(`WebSocket heartbeat timeout for model ${modelId}`);
      clearInterval(client.heartbeatInterval);
      socket.terminate();
      return;
    }

    // Check for connection timeout
    if (Date.now() - client.lastActivity > CONNECTION_TIMEOUT) {
      logger.info(`WebSocket connection timeout for model ${modelId}`);
      clearInterval(client.heartbeatInterval);
      socket.terminate();
      return;
    }

    // Send ping
    client.isAlive = false;
    sendPing(socket);
  }, HEARTBEAT_INTERVAL);

  // Handle native WebSocket pong (from ws library ping/pong)
  socket.on("pong", () => {
    client.isAlive = true;
    client.lastActivity = Date.now();
  });

  // Send initial sync step 1
  const syncEncoder = encoding.createEncoder();
  encoding.writeVarUint(syncEncoder, messageSync);
  syncProtocol.writeSyncStep1(syncEncoder, doc);
  send(socket, encoding.toUint8Array(syncEncoder));

  // Send current awareness state
  const awarenessEncoder = encoding.createEncoder();
  encoding.writeVarUint(awarenessEncoder, messageAwareness);
  encoding.writeVarUint8Array(
    awarenessEncoder,
    awarenessProtocol.encodeAwarenessUpdate(
      awareness,
      Array.from(awareness.getStates().keys()),
    ),
  );
  send(socket, encoding.toUint8Array(awarenessEncoder));

  // Handle incoming messages
  socket.on("message", (data: Buffer) => {
    try {
      handleMessage(collabDoc, client, new Uint8Array(data));
    } catch (err) {
      logger.error({ err }, "Error handling collaboration message");
    }
  });

  // Handle disconnect
  socket.on("close", () => {
    // Clear heartbeat interval
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }

    collabDoc.clients.delete(client);

    // Remove awareness state for this client
    awarenessProtocol.removeAwarenessStates(
      awareness,
      [doc.clientID],
      "disconnect",
    );

    // Clean up empty documents after a delay
    if (collabDoc.clients.size === 0) {
      setTimeout(() => {
        if (collabDoc.clients.size === 0) {
          docs.delete(modelId);
        }
      }, 30000); // 30 second cleanup delay
    }
  });

  // Handle WebSocket errors
  socket.on("error", (err) => {
    logger.error({ err }, `WebSocket error for model ${modelId}`);
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }
  });
}

/**
 * Handle an incoming message from a client.
 */
function handleMessage(
  collabDoc: CollaborativeDoc,
  client: Client,
  message: Uint8Array,
): void {
  const { doc, awareness } = collabDoc;
  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case messageSync: {
      if (client.receiveOnly && carriesDocChange(decoder)) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      const syncMessageType = syncProtocol.readSyncMessage(
        decoder,
        encoder,
        doc,
        client.socket,
      );

      // If this was a sync step 2 or update, broadcast to other clients
      if (
        syncMessageType === syncProtocol.messageYjsSyncStep2 ||
        syncMessageType === syncProtocol.messageYjsUpdate
      ) {
        // Broadcast the update to all other clients
        broadcastUpdate(collabDoc, message, client);
      }

      // Send response if there is one
      if (encoding.length(encoder) > 1) {
        send(client.socket, encoding.toUint8Array(encoder));
      }
      break;
    }
    case messageAwareness: {
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        decoding.readVarUint8Array(decoder),
        client.socket,
      );
      client.lastActivity = Date.now();
      break;
    }
  }
}

/**
 * True when a sync message would change the document (SyncStep2 or Update),
 * as opposed to SyncStep1, which only asks for the server's state. Reads
 * from a copy, so `decoder` itself is not advanced.
 */
function carriesDocChange(decoder: decoding.Decoder): boolean {
  const peek = decoding.clone(decoder);
  const syncType = decoding.readVarUint(peek);
  return (
    syncType === syncProtocol.messageYjsSyncStep2 ||
    syncType === syncProtocol.messageYjsUpdate
  );
}

/**
 * Broadcast a message to all clients.
 */
function broadcastMessage(
  collabDoc: CollaborativeDoc,
  type: number,
  data: Uint8Array,
): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, type);
  encoding.writeVarUint8Array(encoder, data);
  const message = encoding.toUint8Array(encoder);

  for (const client of collabDoc.clients) {
    send(client.socket, message);
  }
}

/**
 * Broadcast an update to all clients except the sender.
 */
function broadcastUpdate(
  collabDoc: CollaborativeDoc,
  message: Uint8Array,
  sender: Client,
): void {
  for (const client of collabDoc.clients) {
    if (client !== sender) {
      send(client.socket, message);
    }
  }
}

/**
 * Send a message to a WebSocket.
 */
function send(socket: WebSocket, message: Uint8Array): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(message);
  }
}

/**
 * Send a WebSocket protocol-level ping for connection keepalive.
 * Do NOT send application-level messages for ping/pong: y-websocket reserves
 * types 2 (messageAuth) and 3 (messageQueryAwareness) — sending type 2 or 3
 * would be misinterpreted by the client and cause decode errors.
 */
function sendPing(socket: WebSocket): void {
  if (socket.readyState === socket.OPEN) {
    socket.ping();
  }
}

/**
 * Get a random color for cursor/selection visualization.
 */
function getRandomColor(): string {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E9",
    "#F8B500",
    "#00CED1",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Get the current state of a document for persistence.
 */
export function getDocState(modelId: string): Uint8Array | null {
  const collabDoc = docs.get(modelId);
  if (!collabDoc) return null;
  return Y.encodeStateAsUpdate(collabDoc.doc);
}

/**
 * Apply a saved state to a document.
 */
export function applyDocState(modelId: string, state: Uint8Array): void {
  const collabDoc = getOrCreateDoc(modelId);
  Y.applyUpdate(collabDoc.doc, state);
}
