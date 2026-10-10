# ADR-002: Use Zustand for Client State Management

**Status:** Accepted
**Date:** 2025-12-30
**Decision Makers:** Architecture Team

---

## Context

ThreatForge needs client-side state management for:
- Canvas state (nodes, edges, selection)
- UI state (panels, dialogs, preferences)
- History state (undo/redo)
- Multi-store coordination

We need a state management solution that:
- Works well with React 18+ concurrent features
- Integrates with React Flow
- Supports TypeScript
- Is simple to use and understand
- Handles complex state updates efficiently

---

## Options Considered

### Option 1: Zustand

**Description:** Small, fast, scalable state management using simplified flux principles.

**Pros:**
- Minimal boilerplate (no reducers, actions, dispatch)
- Works with React 18 concurrent features
- Excellent TypeScript support
- Tiny bundle size (~1KB)
- No providers needed (hooks-based)
- Easy to create multiple stores
- Built-in middleware (persist, devtools)
- Supports subscriptions outside React

**Cons:**
- Less structured than Redux
- No built-in async handling (but easy to add)
- Smaller ecosystem than Redux

### Option 2: Redux Toolkit

**Description:** Official, opinionated Redux setup with reduced boilerplate.

**Pros:**
- Industry standard
- Large ecosystem
- Built-in RTK Query for API
- Excellent devtools
- Structured patterns

**Cons:**
- More boilerplate than Zustand
- Provider required
- Learning curve for newcomers
- Overkill for our use case
- Bundle size larger

### Option 3: Jotai

**Description:** Primitive and flexible state management for React.

**Pros:**
- Atomic state model
- Works well with Suspense
- Small bundle

**Cons:**
- Different mental model (atoms)
- Less intuitive for our canvas state
- Would need many atoms

### Option 4: MobX

**Description:** Simple, scalable state management using observables.

**Pros:**
- Automatic tracking of dependencies
- Easy mutations (no immutability required)

**Cons:**
- Observables can be confusing
- Proxy-based (potential issues)
- Less common in React ecosystem now

### Option 5: React Context + useReducer

**Description:** Built-in React state management.

**Pros:**
- No external dependencies
- Built into React

**Cons:**
- Causes re-renders on any context change
- Need multiple contexts to avoid over-rendering
- More boilerplate
- No devtools

---

## Decision

**We choose Zustand.**

---

## Rationale

1. **Simplicity:** Minimal boilerplate, easy to learn
2. **React Flow compatibility:** Zustand works seamlessly with React Flow's state model
3. **Multi-store:** Easy to have separate stores (canvas, UI, history)
4. **TypeScript:** First-class TypeScript support
5. **Performance:** Selective subscriptions prevent over-rendering
6. **Bundle size:** ~1KB gzipped
7. **Flexibility:** Can access state outside React (e.g., in callbacks)

---

## Implementation

### Store Structure

```typescript
// stores/canvas-store.ts
export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeIds: [],

  addNode: (node) => set((state) => ({
    nodes: [...state.nodes, node]
  })),

  updateNode: (id, data) => set((state) => ({
    nodes: state.nodes.map(n => n.id === id ? { ...n, data } : n)
  })),
}));

// stores/ui-store.ts
export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: true,
  rightPanelOpen: true,

  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
}));

// stores/history-store.ts
export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],

  undo: () => { /* implementation */ },
  redo: () => { /* implementation */ },
}));
```

---

## Consequences

### Positive
- Fast development with minimal boilerplate
- Easy to understand codebase
- Good performance with selective subscriptions
- Works perfectly with React Flow

### Negative
- Less structure may lead to inconsistency
- Team needs to agree on patterns
- No built-in async patterns (we use TanStack Query for that)

### Mitigations
- Use TanStack Query for all server state
- Keep stores focused (single responsibility)

---

## References

- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Zustand GitHub](https://github.com/pmndrs/zustand)
- [React Flow + Zustand Example](https://reactflow.dev/examples/interaction/save-and-restore)
