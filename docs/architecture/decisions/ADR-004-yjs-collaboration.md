# ADR-004: Use Yjs for Real-Time Collaboration

**Status:** Accepted
**Date:** 2025-12-30
**Decision Makers:** Architecture Team

---

## Context

ThreatForge requires real-time collaboration where multiple users can:
- Edit the same threat model simultaneously
- See each other's cursors and selections
- Have changes sync instantly without conflicts
- Work offline and sync when reconnected

We need a technology that handles:
- Concurrent edits without conflicts
- Low-latency synchronization
- Offline support with eventual consistency
- Integration with React Flow state

---

## Options Considered

### Option 1: Yjs (CRDT)

**Description:** Modular CRDT framework for building collaborative applications.

**Pros:**
- Conflict-free by design (CRDT)
- Works offline
- Peer-to-peer capable
- Multiple providers (WebSocket, WebRTC, IndexedDB)
- Awareness protocol (cursors, selections)
- React bindings available
- Active development
- Battle-tested (used by Notion, Figma-like apps)

**Cons:**
- Learning curve for CRDT concepts
- Memory usage for large documents
- Need to model data as Yjs types

### Option 2: Automerge

**Description:** JSON-like data structure that can be modified concurrently.

**Pros:**
- JSON-like API
- CRDT-based
- Good documentation

**Cons:**
- Larger bundle size than Yjs
- Less mature WebSocket provider
- Fewer React integrations

### Option 3: Operational Transformation (OT)

**Description:** Traditional approach (Google Docs, ShareJS).

**Pros:**
- Well understood
- Smaller payloads

**Cons:**
- Requires central server for ordering
- More complex to implement correctly
- No offline support
- Transform functions are complex

### Option 4: Firebase Realtime Database

**Description:** Managed real-time sync from Google.

**Pros:**
- Managed service
- Easy to start
- Good SDK

**Cons:**
- Vendor lock-in
- Conflict resolution is last-write-wins
- No CRDT semantics
- Costs can grow

### Option 5: Socket.io + Custom Merge

**Description:** Build custom sync with Socket.io.

**Pros:**
- Full control
- Simple to start

**Cons:**
- Need to solve conflict resolution ourselves
- Likely to have edge cases
- Significant development effort
- No offline support

---

## Decision

**We choose Yjs with WebSocket provider.**

---

## Rationale

1. **CRDT:** Conflicts are mathematically impossible - operations merge automatically
2. **Offline:** Users can work offline, sync when reconnected
3. **Awareness:** Built-in protocol for cursors, selections, user presence
4. **React Flow:** Can wrap React Flow state in Yjs types
5. **Providers:** Multiple options (WebSocket, WebRTC, IndexedDB)
6. **Performance:** Efficient binary sync protocol
7. **Ecosystem:** y-websocket, y-indexeddb, y-protocols well maintained

---

## Implementation

### Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   User A        │◄──────────────────►│    Server       │
│   (Yjs Doc)     │                    │  (y-websocket)  │
└─────────────────┘                    └────────┬────────┘
                                                │
┌─────────────────┐     WebSocket              │
│   User B        │◄───────────────────────────┘
│   (Yjs Doc)     │
└─────────────────┘

All clients share same Yjs document.
Updates sync via binary Yjs protocol.
Server can persist to Redis for scale.
```

### Client Integration

```typescript
// hooks/useCollaborativeCanvas.ts
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export function useCollaborativeCanvas(modelId: string) {
  const doc = useMemo(() => new Y.Doc(), []);

  const provider = useMemo(() =>
    new WebsocketProvider(
      WS_URL,
      `model-${modelId}`,
      doc
    ), [modelId, doc]
  );

  // Yjs types for canvas state
  const yNodes = doc.getArray<Node>('nodes');
  const yEdges = doc.getArray<Edge>('edges');

  // Awareness for cursors
  const awareness = provider.awareness;

  return { yNodes, yEdges, awareness };
}
```

### Server Setup

```typescript
// server/src/websocket.ts
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const modelId = getModelIdFromUrl(req.url);
  setupWSConnection(ws, req, { docName: modelId });
});
```

---

## Consequences

### Positive
- True real-time collaboration without conflicts
- Users can work offline and sync later
- Cursor awareness enhances collaboration
- Scales horizontally with Redis

### Negative
- Yjs types are different from regular JS
- Need to map between Yjs and React Flow state
- Memory usage for large documents
- Learning curve for team

### Mitigations
- Create abstraction layer over Yjs
- Use y-indexeddb for offline persistence
- Paginate or lazy-load large models
- Document patterns and examples

---

## References

- [Yjs Documentation](https://docs.yjs.dev/)
- [Yjs GitHub](https://github.com/yjs/yjs)
- [y-websocket](https://github.com/yjs/y-websocket)
- [CRDT Paper](https://hal.inria.fr/inria-00555588/)
