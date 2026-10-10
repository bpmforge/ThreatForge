# ADR-001: Use React Flow for Canvas Diagramming

**Status:** Accepted
**Date:** 2025-12-30
**Decision Makers:** Architecture Team

---

## Context

ThreatForge requires a visual canvas for creating threat model diagrams with:
- Drag-and-drop components
- Connections (edges) between components
- Grouping (trust boundaries)
- Zoom, pan, minimap
- Custom node rendering
- Real-time collaboration support

We need to choose a diagramming library that meets these requirements.

---

## Options Considered

### Option 1: React Flow (@xyflow/react)

**Description:** A highly customizable React library for building node-based editors and diagrams.

**Pros:**
- Purpose-built for node-based diagrams
- Highly customizable nodes and edges
- Built-in zoom, pan, minimap, controls
- Excellent React integration (hooks-based)
- Active development, strong community
- MIT licensed
- Supports grouping (parent nodes)
- Performance optimized (virtualization)
- TypeScript support

**Cons:**
- Learning curve for customization
- Pro features require license (we use open source)

### Option 2: JointJS / Rappid

**Description:** Commercial diagramming library with free open-source tier.

**Pros:**
- Mature, feature-rich
- Good documentation
- Hierarchical diagrams

**Cons:**
- Not React-native (requires wrapper)
- Commercial license needed for full features ($5k+)
- Heavier bundle size
- Less modern API

### Option 3: GoJS

**Description:** Commercial JavaScript diagramming library.

**Pros:**
- Very feature-rich
- Excellent performance
- Good for complex diagrams

**Cons:**
- Commercial license required ($3k+)
- Not React-native
- Steeper learning curve
- Overkill for our needs

### Option 4: Cytoscape.js

**Description:** Open-source graph theory library for visualization.

**Pros:**
- Free and open source
- Good for network graphs
- Extensive layout algorithms

**Cons:**
- Graph-focused, not diagram-focused
- Limited node customization
- Not ideal for threat modeling UI
- Less intuitive for end users

### Option 5: Custom Canvas (HTML5 Canvas / SVG)

**Description:** Build custom diagramming from scratch.

**Pros:**
- Full control
- No dependencies

**Cons:**
- Enormous development effort
- Need to build all interactions from scratch
- Performance optimization is complex
- Would take months

---

## Decision

**We choose React Flow (@xyflow/react).**

---

## Rationale

1. **React-native:** Seamless integration with our React/Next.js stack
2. **Customization:** Can create custom node components for threat modeling
3. **Features:** Built-in zoom, pan, minimap, selection, connection handling
4. **Grouping:** Parent node support enables trust boundaries
5. **Performance:** Handles 100+ nodes efficiently
6. **Community:** Active development, good documentation, examples
7. **Cost:** MIT licensed, no commercial license needed
8. **Collaboration:** State-based, works well with Yjs for real-time sync

---

## Consequences

### Positive
- Fast development of canvas features
- Professional look and feel out of the box
- Easy to customize component appearance
- Works with Zustand for state management

### Negative
- Locked into React Flow's paradigms
- Need to work around any limitations
- Pro features (like undo/redo helper) not available in free tier

### Mitigations
- Implement undo/redo ourselves using history store
- Abstract React Flow behind our own canvas store

---

## References

- [React Flow Documentation](https://reactflow.dev/)
- [React Flow Examples](https://reactflow.dev/examples)
- [React Flow GitHub](https://github.com/xyflow/xyflow)
