# ADR-007: Remove the AntV X6 canvas

**Status:** Accepted (2026-09-03)  **Supersedes:** the June 2026 X6 decision (DECISION.md)

## Context
X6 was adopted in June 2026 for its collaboration binding. By August, React Flow
already had Yjs collaboration in production (`features/collaboration`), and the
React Flow canvas was judged the better-looking, smoother renderer. X6 stayed in
the tree behind the `x6-canvas` flag (default OFF everywhere, including prod)
as a rollback. The September 2026 canvas work — trust-zone containment with
10px clearance, adoption on move/resize, Lucid-grade connectors, end labels,
per-commit edge geometry — was built on React Flow only.

## Decision
React Flow is the canvas. The X6 renderer, spike, labs shell, e2e siblings,
API-surface script and the `@antv/x6*` dependencies are removed. The
`x6-canvas` feature flag is gone; there is no renderer switch.

## Consequences
- ~70 files and two runtime dependencies removed; smaller install and prod image.
- `ComponentNodeInner` / `BoundaryNodeInner` no longer need to stay React-Flow-agnostic.
- Any future second renderer is a fresh decision, not a flag flip.
