/**
 * Floating connection drop — the Lucid/draw.io behaviour where releasing a
 * connection anywhere ON a shape attaches it, rather than only on a port.
 *
 * Pure helpers so the decision (which node, which side) is unit-testable; the
 * DOM lookup lives in the hook that calls them.
 */
import type { CanvasNode } from "@/stores/canvas";
import { getAbsolutePosition, getNodeSize } from "@/stores/canvas/geometry";
import type { ComponentNodeData } from "@/types/canvas";

export type StaticTargetHandle =
  | "handle-left"
  | "handle-right-t"
  | "handle-top"
  | "handle-bottom";

/**
 * The target-side handle that faces the source — a line coming from the left
 * should enter through the left port, one from above through the top port.
 * Returns null when the target renders interface handles instead of the
 * built-in ones (React Flow then picks the node's first target handle).
 */
export function pickFacingTargetHandle(
  source: CanvasNode,
  target: CanvasNode,
  nodes: CanvasNode[],
): StaticTargetHandle | null {
  const ifaces = (target.data as Partial<ComponentNodeData>)?.interfaces;
  if (ifaces && ifaces.length > 0) return null;

  const s = getAbsolutePosition(source, nodes);
  const t = getAbsolutePosition(target, nodes);
  const ss = getNodeSize(source);
  const ts = getNodeSize(target);
  const dx = t.x + ts.width / 2 - (s.x + ss.width / 2);
  const dy = t.y + ts.height / 2 - (s.y + ss.height / 2);

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "handle-left" : "handle-right-t";
  }
  return dy >= 0 ? "handle-top" : "handle-bottom";
}

/** Nodes a floating drop may attach to: components other than the source. */
export function isDroppableTarget(
  node: CanvasNode | undefined,
  sourceId: string,
): node is CanvasNode {
  return !!node && node.type === "component" && node.id !== sourceId;
}

/** The canvas node under a client-space point, via the React Flow node wrapper. */
export function nodeIdAtPoint(clientX: number, clientY: number): string | null {
  if (typeof document === "undefined") return null;
  const el = document.elementFromPoint(clientX, clientY);
  const wrapper = el?.closest<HTMLElement>(".react-flow__node");
  return wrapper?.getAttribute("data-id") ?? null;
}
