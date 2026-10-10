/**
 * A receive-only collaboration client (a read-only account) gets the document
 * but cannot change it: its Yjs updates are dropped, not applied or relayed.
 */
import { describe, it, expect, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import type { WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import { handleConnection, getOrCreateDoc } from "../collaboration.js";

class FakeSocket extends EventEmitter {
  OPEN = 1;
  readyState = 1;
  sent: Uint8Array[] = [];
  send(m: Uint8Array) {
    this.sent.push(m);
  }
  ping() {}
  terminate() {}
}

const sockets: FakeSocket[] = [];
afterEach(() => {
  for (const s of sockets.splice(0)) s.emit("close");
});

function connect(modelId: string, receiveOnly: boolean): FakeSocket {
  const socket = new FakeSocket();
  sockets.push(socket);
  handleConnection(socket as unknown as WebSocket, modelId, "u1", "User", {
    receiveOnly,
  });
  return socket;
}

/** A sync "update" message that adds one node, as a y-websocket client sends it. */
function nodeUpdateMessage(): Uint8Array {
  const local = new Y.Doc();
  local.getArray("nodes").push([{ id: "n1" }]);
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0); // messageSync
  syncProtocol.writeUpdate(encoder, Y.encodeStateAsUpdate(local));
  return encoding.toUint8Array(encoder);
}

describe("collaboration receive-only clients", () => {
  it("drops document updates from a receive-only client", () => {
    const modelId = `ro-${Date.now()}`;
    const reader = connect(modelId, true);
    const other = connect(modelId, false);
    const sentBefore = other.sent.length;

    reader.emit("message", Buffer.from(nodeUpdateMessage()));

    expect(getOrCreateDoc(modelId).doc.getArray("nodes").length).toBe(0);
    expect(other.sent.length).toBe(sentBefore);
  });

  it("still sends the document to a receive-only client", () => {
    const reader = connect(`ro-sync-${Date.now()}`, true);
    expect(reader.sent.length).toBeGreaterThan(0);
  });

  it("applies updates from a normal client", () => {
    const modelId = `rw-${Date.now()}`;
    const writer = connect(modelId, false);
    writer.emit("message", Buffer.from(nodeUpdateMessage()));
    expect(getOrCreateDoc(modelId).doc.getArray("nodes").length).toBe(1);
  });
});
