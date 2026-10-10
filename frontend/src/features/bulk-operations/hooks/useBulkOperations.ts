import { useCallback } from "react";
import { toast } from "sonner";
import { useCanvasStore } from "@/stores/canvas";
import { useHistoryStore, createSnapshot } from "@/stores/history-store";
import { computeMatchedSizes, type MatchSizeMode } from "../utils/matchSize";

type AlignDirection = "left" | "center" | "right" | "top" | "middle" | "bottom";
type DistributeMode = "gap" | "centers";

export function useBulkOperations() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const deleteSelected = useCanvasStore((s) => s.deleteSelected);
  const updateNodeParent = useCanvasStore((s) => s.updateNodeParent);
  const push = useHistoryStore((s) => s.push);

  const canDelete = selectedNodeIds.length > 0;
  const canMove = selectedNodeIds.length > 0;
  const canAlign = selectedNodeIds.length >= 2;
  const canDistribute = selectedNodeIds.length >= 3;
  const canMatchSize = selectedNodeIds.length >= 2;

  const deleteSelectedHandler = useCallback(() => {
    if (!canDelete) return;
    deleteSelected();
    toast.success(`Deleted ${selectedNodeIds.length} items`);
  }, [canDelete, deleteSelected, selectedNodeIds.length]);

  const moveToParent = useCallback(
    (parentId: string | null) => {
      if (!canMove) return;
      selectedNodeIds.forEach((nodeId) => updateNodeParent(nodeId, parentId));
    },
    [canMove, selectedNodeIds, updateNodeParent],
  );

  const alignNodes = useCallback(
    (direction: AlignDirection) => {
      if (!canAlign) return;
      push(createSnapshot(nodes, edges), "Align Nodes");

      // Skip locked nodes for position changes
      const selected = nodes.filter(
        (n) => selectedNodeIds.includes(n.id) && !n.data.locked,
      );
      const dims = selected.map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        w: (n.measured?.width ?? 160) as number,
        h: (n.measured?.height ?? 60) as number,
      }));

      const minX = Math.min(...dims.map((d) => d.x));
      const maxX = Math.max(...dims.map((d) => d.x + d.w));
      const minY = Math.min(...dims.map((d) => d.y));
      const maxY = Math.max(...dims.map((d) => d.y + d.h));
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      useCanvasStore.setState((state) => ({
        nodes: state.nodes.map((n) => {
          if (!selectedNodeIds.includes(n.id)) return n;
          if (n.data.locked) return n;
          const d = dims.find((d) => d.id === n.id)!;
          let x = n.position.x;
          let y = n.position.y;
          if (direction === "left") x = minX;
          else if (direction === "right") x = maxX - d.w;
          else if (direction === "center") x = midX - d.w / 2;
          else if (direction === "top") y = minY;
          else if (direction === "bottom") y = maxY - d.h;
          else if (direction === "middle") y = midY - d.h / 2;
          return { ...n, position: { x, y } };
        }),
        isDirty: true,
      }));
    },
    [canAlign, nodes, edges, selectedNodeIds, push],
  );

  const distributeNodes = useCallback(
    (axis: "horizontal" | "vertical", mode: DistributeMode = "gap") => {
      if (!canDistribute) return;
      push(createSnapshot(nodes, edges), "Distribute Nodes");

      const selected = nodes.filter(
        (n) => selectedNodeIds.includes(n.id) && !n.data.locked,
      );
      const dims = selected.map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        w: (n.measured?.width ?? 160) as number,
        h: (n.measured?.height ?? 60) as number,
      }));

      const positions = new Map<string, { x: number; y: number }>();

      if (axis === "horizontal") {
        const sorted = [...dims].sort((a, b) => a.x - b.x);
        if (mode === "centers") {
          const firstCx = sorted[0].x + sorted[0].w / 2;
          const lastCx = sorted.at(-1)!.x + sorted.at(-1)!.w / 2;
          const step = (lastCx - firstCx) / (sorted.length - 1);
          for (let i = 1; i < sorted.length - 1; i++) {
            const cx = firstCx + i * step;
            positions.set(sorted[i].id, {
              x: cx - sorted[i].w / 2,
              y: sorted[i].y,
            });
          }
        } else {
          const span = sorted.at(-1)!.x + sorted.at(-1)!.w - sorted[0].x;
          const totalW = sorted.reduce((s, d) => s + d.w, 0);
          const gap = (span - totalW) / (sorted.length - 1);
          let curX = sorted[0].x + sorted[0].w + gap;
          for (let i = 1; i < sorted.length - 1; i++) {
            positions.set(sorted[i].id, { x: curX, y: sorted[i].y });
            curX += sorted[i].w + gap;
          }
        }
      } else {
        const sorted = [...dims].sort((a, b) => a.y - b.y);
        if (mode === "centers") {
          const firstCy = sorted[0].y + sorted[0].h / 2;
          const lastCy = sorted.at(-1)!.y + sorted.at(-1)!.h / 2;
          const step = (lastCy - firstCy) / (sorted.length - 1);
          for (let i = 1; i < sorted.length - 1; i++) {
            const cy = firstCy + i * step;
            positions.set(sorted[i].id, {
              x: sorted[i].x,
              y: cy - sorted[i].h / 2,
            });
          }
        } else {
          const sorted2 = [...dims].sort((a, b) => a.y - b.y);
          const span = sorted2.at(-1)!.y + sorted2.at(-1)!.h - sorted2[0].y;
          const totalH = sorted2.reduce((s, d) => s + d.h, 0);
          const gap = (span - totalH) / (sorted2.length - 1);
          let curY = sorted2[0].y + sorted2[0].h + gap;
          for (let i = 1; i < sorted2.length - 1; i++) {
            positions.set(sorted2[i].id, { x: sorted2[i].x, y: curY });
            curY += sorted2[i].h + gap;
          }
        }
      }

      useCanvasStore.setState((state) => ({
        nodes: state.nodes.map((n) => {
          const pos = positions.get(n.id);
          return pos ? { ...n, position: pos } : n;
        }),
        isDirty: true,
      }));
    },
    [canDistribute, nodes, edges, selectedNodeIds, push],
  );

  /** Match width/height of targets to a reference node. Reference is the first selected node. */
  const matchSize = useCallback(
    (referenceNodeId: string, mode: MatchSizeMode) => {
      if (!canMatchSize) return;
      const ref = nodes.find((n) => n.id === referenceNodeId);
      if (!ref) return;
      push(createSnapshot(nodes, edges), "Match Size");

      const refW = (ref.style?.width as number) ?? ref.measured?.width ?? 160;
      const refH = (ref.style?.height as number) ?? ref.measured?.height ?? 60;

      const targets = nodes
        .filter(
          (n) => selectedNodeIds.includes(n.id) && n.id !== referenceNodeId,
        )
        .map((n) => ({
          id: n.id,
          locked: !!(n.data as { locked?: boolean }).locked,
          width: (n.style?.width as number) ?? n.measured?.width ?? 160,
          height: (n.style?.height as number) ?? n.measured?.height ?? 60,
        }));

      const sizes = computeMatchedSizes(
        { width: refW, height: refH },
        targets,
        mode,
      );

      useCanvasStore.setState((state) => ({
        nodes: state.nodes.map((n) => {
          const s = sizes.get(n.id);
          if (!s) return n;
          return {
            ...n,
            style: { ...n.style, width: s.width, height: s.height },
          };
        }),
        isDirty: true,
      }));
    },
    [canMatchSize, nodes, edges, selectedNodeIds, push],
  );

  return {
    deleteSelected: deleteSelectedHandler,
    moveToParent,
    alignNodes,
    distributeNodes,
    matchSize,
    canDelete,
    canMove,
    canAlign,
    canDistribute,
    canMatchSize,
  };
}
