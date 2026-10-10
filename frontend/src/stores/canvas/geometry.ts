/**
 * Canvas geometry helpers shared by the trust-boundary containment logic,
 * drag feedback, and alignment guides.
 *
 * React Flow stores a child node's `position` RELATIVE to its parent. Every
 * containment / alignment decision has to be made in ONE frame, so these
 * helpers convert to absolute canvas coordinates by walking the parent chain.
 */
import type { CanvasNode } from "./types";

const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 60;
const DEFAULT_BOUNDARY_WIDTH = 400;
const DEFAULT_BOUNDARY_HEIGHT = 300;
/** Footprint of a collapsed boundary (its header pill). */
const COLLAPSED_BOUNDARY_WIDTH = 240;
const COLLAPSED_BOUNDARY_HEIGHT = 40;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoundaryRect extends Rect {
  id: string;
}

type Sized = Pick<CanvasNode, "type" | "style" | "width" | "height"> & {
  measured?: { width?: number; height?: number };
  data?: unknown;
};

/** Rendered size of a node, falling back to per-type defaults. */
export function getNodeSize(node: Sized): { width: number; height: number } {
  const isContainer =
    node.type === "boundary" ||
    node.type === "swimlane" ||
    node.type === "legend";
  // A collapsed boundary renders as its header pill only; its stored size
  // must not keep claiming the canvas underneath it for drops / adoption.
  if (
    node.type === "boundary" &&
    (node as { data?: { collapsed?: boolean } }).data?.collapsed
  ) {
    return {
      width: COLLAPSED_BOUNDARY_WIDTH,
      height: COLLAPSED_BOUNDARY_HEIGHT,
    };
  }
  const styleW = node.style?.width;
  const styleH = node.style?.height;
  const width =
    node.measured?.width ??
    (typeof styleW === "number" ? styleW : undefined) ??
    node.width ??
    (isContainer ? DEFAULT_BOUNDARY_WIDTH : DEFAULT_NODE_WIDTH);
  const height =
    node.measured?.height ??
    (typeof styleH === "number" ? styleH : undefined) ??
    node.height ??
    (isContainer ? DEFAULT_BOUNDARY_HEIGHT : DEFAULT_NODE_HEIGHT);
  return { width, height };
}

/**
 * Absolute canvas position of a node — walks the parent chain. Accepts an
 * optional override for the node's own (relative) position so an in-flight
 * drag position can be resolved without mutating the store.
 */
export function getAbsolutePosition(
  node: Pick<CanvasNode, "id" | "position" | "parentId">,
  nodes: CanvasNode[],
  positionOverride?: { x: number; y: number },
): { x: number; y: number } {
  let x = (positionOverride ?? node.position).x;
  let y = (positionOverride ?? node.position).y;
  const seen = new Set<string>([node.id]);
  let parentId = node.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

/** Convert an absolute position into the frame of `parentId` (null = top level). */
export function toRelativePosition(
  absolute: { x: number; y: number },
  parentId: string | null | undefined,
  nodes: CanvasNode[],
): { x: number; y: number } {
  if (!parentId) return { ...absolute };
  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return { ...absolute };
  const parentAbs = getAbsolutePosition(parent, nodes);
  return { x: absolute.x - parentAbs.x, y: absolute.y - parentAbs.y };
}

/** Absolute rects of every boundary node. */
export function getBoundaryRects(nodes: CanvasNode[]): BoundaryRect[] {
  return nodes
    .filter((n) => n.type === "boundary")
    .map((n) => {
      const { width, height } = getNodeSize(n);
      const { x, y } = getAbsolutePosition(n, nodes);
      return { id: n.id, x, y, width, height };
    });
}

export function rectContainsPoint(
  rect: Rect,
  point: { x: number; y: number },
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/** Ids of `nodeId` plus every node nested (transitively) inside it. */
export function getDescendantIds(
  nodeId: string,
  nodes: CanvasNode[],
): Set<string> {
  const ids = new Set<string>([nodeId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of nodes) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        grew = true;
      }
    }
  }
  return ids;
}

/**
 * The boundary whose rect contains `center`, preferring the INNERMOST
 * (smallest-area) one so nested boundaries resolve correctly. `exclude`
 * removes candidates — the dragged node itself and its descendants, so a
 * boundary can never become its own child.
 */
export function findInnermostBoundary(
  center: { x: number; y: number },
  boundaries: BoundaryRect[],
  exclude: Set<string> = new Set(),
): BoundaryRect | null {
  let best: BoundaryRect | null = null;
  for (const b of boundaries) {
    if (exclude.has(b.id)) continue;
    if (!rectContainsPoint(b, center)) continue;
    if (!best || b.width * b.height < best.width * best.height) best = b;
  }
  return best;
}

/**
 * React Flow requires a parent to appear BEFORE its children in the nodes
 * array. Stable sort by nesting depth so persisted / synced canvases load in
 * a valid order regardless of how they were saved.
 */
export function sortParentsFirst<T extends Pick<CanvasNode, "id" | "parentId">>(
  nodes: T[],
): T[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depthOf = (n: T): number => {
    let depth = 0;
    const seen = new Set<string>([n.id]);
    let pid = n.parentId;
    while (pid && byId.has(pid) && !seen.has(pid)) {
      seen.add(pid);
      depth++;
      pid = byId.get(pid)!.parentId;
    }
    return depth;
  };
  return nodes
    .map((n, i) => ({ n, i, d: depthOf(n) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.n);
}

// ── Boundary fit ─────────────────────────────────────────────────────────────

/** Clear space between a child's nearest edge and the boundary's interior edge. */
export const BOUNDARY_INNER_PAD = 10;
/** Header strip at the top of a boundary; children must sit below it. */
export const BOUNDARY_HEADER_HEIGHT = 40;
export const MIN_BOUNDARY_WIDTH = 200;
export const MIN_BOUNDARY_HEIGHT = 150;

/**
 * Smallest size that keeps every child (positions relative to the boundary)
 * fully inside with BOUNDARY_INNER_PAD clearance on the right and bottom.
 * Left/top clearance is handled by fitBoundaryToChildren, which can move the
 * boundary's origin.
 */
export function minBoundarySize(children: CanvasNode[]): {
  width: number;
  height: number;
} {
  let maxRight = 0;
  let maxBottom = 0;
  for (const child of children) {
    const { width, height } = getNodeSize(child);
    maxRight = Math.max(maxRight, child.position.x + width);
    maxBottom = Math.max(maxBottom, child.position.y + height);
  }
  return {
    width: Math.max(MIN_BOUNDARY_WIDTH, maxRight + BOUNDARY_INNER_PAD),
    height: Math.max(MIN_BOUNDARY_HEIGHT, maxBottom + BOUNDARY_INNER_PAD),
  };
}

/**
 * Grow a boundary so every child is completely inside it: at least
 * BOUNDARY_INNER_PAD from the left/right/bottom interior edges and below the
 * header on top. A child hugging the left or top edge pushes the boundary's
 * ORIGIN outward (children shift to keep their absolute position), a child
 * hugging the right or bottom grows the size. Never shrinks. Cascades to the
 * enclosing boundary so a nested zone that grew stays inside its parent.
 * Pure: returns the same array when nothing needs to change.
 */
export function fitBoundaryToChildren(
  nodes: CanvasNode[],
  boundaryId: string,
  visited: Set<string> = new Set(),
): CanvasNode[] {
  // A parent cycle (possible only via concurrent collab edits) must not
  // recurse forever.
  if (visited.has(boundaryId)) return nodes;
  visited.add(boundaryId);
  const boundary = nodes.find((n) => n.id === boundaryId);
  if (!boundary || boundary.type !== "boundary") return nodes;
  // A collapsed zone is just its header: nothing fits inside it.
  if ((boundary.data as { collapsed?: boolean } | undefined)?.collapsed)
    return nodes;
  const children = nodes.filter((n) => n.parentId === boundaryId);
  if (children.length === 0) return nodes;

  let minLeft = Infinity;
  let minTop = Infinity;
  for (const c of children) {
    minLeft = Math.min(minLeft, c.position.x);
    minTop = Math.min(minTop, c.position.y);
  }
  const shiftX = Math.max(0, BOUNDARY_INNER_PAD - minLeft);
  const shiftY = Math.max(
    0,
    BOUNDARY_HEADER_HEIGHT + BOUNDARY_INNER_PAD - minTop,
  );

  const shifted = children.map((c) => ({
    ...c,
    position: { x: c.position.x + shiftX, y: c.position.y + shiftY },
  }));
  const current = getNodeSize(boundary);
  const needed = minBoundarySize(shifted);
  const width = Math.max(current.width + shiftX, needed.width);
  const height = Math.max(current.height + shiftY, needed.height);

  const unchanged =
    shiftX === 0 &&
    shiftY === 0 &&
    width === current.width &&
    height === current.height;
  if (unchanged) return nodes;

  const shiftedById = new Map(shifted.map((c) => [c.id, c]));
  const out = nodes.map((n) => {
    if (n.id === boundaryId) {
      return {
        ...n,
        position: { x: n.position.x - shiftX, y: n.position.y - shiftY },
        style: { ...n.style, width, height },
        width,
        height,
        measured: n.measured ? { width, height } : n.measured,
      };
    }
    return shiftedById.get(n.id) ?? n;
  });

  return boundary.parentId
    ? fitBoundaryToChildren(out, boundary.parentId, visited)
    : out;
}

/**
 * After a boundary moves or is resized, any node whose centre now lies
 * inside it (and is not already inside a smaller boundary nested there)
 * becomes its child — so a component can never be left straddling the
 * boundary's edge. Returns the same array when nothing changes; callers
 * should run fitBoundaryToChildren afterwards so adopted nodes get their
 * 10px clearance.
 */
export function adoptContainedNodes(
  nodes: CanvasNode[],
  boundaryId: string,
): CanvasNode[] {
  const boundary = nodes.find((n) => n.id === boundaryId);
  if (!boundary || boundary.type !== "boundary") return nodes;
  const rects = getBoundaryRects(nodes);
  const mine = rects.find((r) => r.id === boundaryId);
  if (!mine) return nodes;
  const family = getDescendantIds(boundaryId, nodes);

  let changed = false;
  let out = nodes;
  for (const n of nodes) {
    if (family.has(n.id)) continue;
    if (n.type !== "component" && n.type !== "boundary") continue;
    if (n.parentId === boundaryId) continue;
    const { width, height } = getNodeSize(n);
    if (n.type === "boundary" && width * height >= mine.width * mine.height)
      continue;
    const abs = getAbsolutePosition(n, nodes);
    const center = { x: abs.x + width / 2, y: abs.y + height / 2 };
    const exclude = getDescendantIds(n.id, nodes);
    const innermost = findInnermostBoundary(
      center,
      rects.filter((r) => r.width * r.height > width * height),
      exclude,
    );
    if (innermost?.id !== boundaryId) continue;
    const rel = toRelativePosition(abs, boundaryId, nodes);
    out = out.map((m) =>
      m.id === n.id
        ? { ...m, parentId: boundaryId, position: rel, extent: undefined }
        : m,
    );
    changed = true;
  }
  return changed ? sortParentsFirst(out) : nodes;
}

/**
 * Which boundary should own `node` if it sits at `absolutePosition`?
 * Innermost containing boundary wins; the node itself, its descendants, and
 * any boundary smaller than the node are never candidates.
 */
export function resolveContainingBoundary(
  node: CanvasNode,
  absolutePosition: { x: number; y: number },
  nodes: CanvasNode[],
): string | null {
  const { width, height } = getNodeSize(node);
  const center = {
    x: absolutePosition.x + width / 2,
    y: absolutePosition.y + height / 2,
  };
  const exclude = getDescendantIds(node.id, nodes);
  const candidates = getBoundaryRects(nodes).filter(
    (b) => b.width * b.height > width * height,
  );
  return findInnermostBoundary(center, candidates, exclude)?.id ?? null;
}
