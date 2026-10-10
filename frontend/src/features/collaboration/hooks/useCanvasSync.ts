/**
 * Canvas Sync Hook - Syncs Yjs Y.Array with canvas store.
 */
import { useEffect, useRef } from "react";
import * as Y from "yjs";
import {
  useCanvasStore,
  type CanvasNode,
  type CanvasEdge,
} from "@/stores/canvas";

function dedupById<T extends { id?: unknown }>(items: T[]): T[] {
  const seen = new Set<unknown>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

interface UseCanvasSyncOptions {
  doc: Y.Doc | null;
  isConnected: boolean;
  getNodesArray: () => Y.Array<unknown> | null;
  getEdgesArray: () => Y.Array<unknown> | null;
}

/** Hook that syncs canvas store with Yjs for real-time collaboration. */
export function useCanvasSync({
  doc,
  isConnected,
  getNodesArray,
  getEdgesArray,
}: UseCanvasSyncOptions): void {
  const isInitializedRef = useRef(false);
  const isRemoteUpdateRef = useRef(false);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);

  // Sync Yjs → Zustand
  useEffect(() => {
    const nodesArray = getNodesArray();
    const edgesArray = getEdgesArray();
    if (!nodesArray || !edgesArray) return;

    const syncFromYjs = () => {
      isRemoteUpdateRef.current = true;
      try {
        loadCanvas(
          dedupById(nodesArray.toArray() as CanvasNode[]),
          dedupById(edgesArray.toArray() as CanvasEdge[]),
        );
        // Mark dirty while ref is true so the Zustand→Yjs subscription stays
        // blocked and cannot re-fire, avoiding an infinite sync loop.
        // loadCanvas always sets isDirty:false, so we restore it here to ensure
        // remote Yjs changes are persisted to canvasState via auto-save.
        useCanvasStore.setState({ isDirty: true });
      } finally {
        isRemoteUpdateRef.current = false;
      }
    };

    nodesArray.observe(syncFromYjs);
    edgesArray.observe(syncFromYjs);
    return () => {
      nodesArray.unobserve(syncFromYjs);
      edgesArray.unobserve(syncFromYjs);
    };
  }, [getNodesArray, getEdgesArray, loadCanvas]);

  // Initialize sync
  useEffect(() => {
    if (!isConnected || !doc || isInitializedRef.current) return;
    const nodesArray = getNodesArray();
    const edgesArray = getEdgesArray();
    if (!nodesArray || !edgesArray) return;

    if (nodesArray.length > 0 || edgesArray.length > 0) {
      isRemoteUpdateRef.current = true;
      try {
        loadCanvas(
          dedupById(nodesArray.toArray() as CanvasNode[]),
          dedupById(edgesArray.toArray() as CanvasEdge[]),
        );
      } finally {
        isRemoteUpdateRef.current = false;
      }
    } else if (nodes.length > 0 || edges.length > 0) {
      doc.transact(() => {
        nodes.forEach((node) => nodesArray.push([node]));
        edges.forEach((edge) => edgesArray.push([edge]));
      });
    }
    isInitializedRef.current = true;
  }, [
    isConnected,
    doc,
    getNodesArray,
    getEdgesArray,
    loadCanvas,
    nodes,
    edges,
  ]);

  // Sync Zustand → Yjs
  useEffect(() => {
    if (!doc || !isConnected) return;
    const unsubscribe = useCanvasStore.subscribe(
      (state) => ({ nodes: state.nodes, edges: state.edges }),
      ({ nodes: newNodes, edges: newEdges }) => {
        if (isRemoteUpdateRef.current) return;
        const nodesArray = getNodesArray();
        const edgesArray = getEdgesArray();
        if (!nodesArray || !edgesArray) return;

        doc.transact(() => {
          nodesArray.delete(0, nodesArray.length);
          newNodes.forEach((node) => nodesArray.push([node]));
          edgesArray.delete(0, edgesArray.length);
          newEdges.forEach((edge) => edgesArray.push([edge]));
        });
      },
    );
    return unsubscribe;
  }, [doc, isConnected, getNodesArray, getEdgesArray]);
}
