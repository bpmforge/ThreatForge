"use client";

/**
 * AttackChainOverlay — highlights canvas nodes belonging to the selected attack chain (A11).
 *
 * Uses useEffect + useCanvasStore.updateNodeData to apply/remove chainHighlight
 * on the matching component nodes. ComponentNode reads data.chainHighlight to
 * render a colored ring.
 */
import { useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas";
import type { AttackChainWithHops } from "../types";

interface AttackChainOverlayProps {
  chain: AttackChainWithHops | null;
}

export function AttackChainOverlay({ chain }: AttackChainOverlayProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  useEffect(() => {
    if (!chain) {
      // Clear highlights from all nodes that have one
      nodes.forEach((node) => {
        if (node.data.chainHighlight) {
          updateNodeData(node.id, { chainHighlight: undefined });
        }
      });
      return;
    }

    // Build a set of highlighted node ids and their roles
    const roleMap = new Map<string, "entry" | "target" | "intermediate">();

    chain.hops.forEach((hop, index) => {
      // Match hop.componentId against node id or node data label
      const matchingNode = nodes.find(
        (n) => n.id === hop.componentId || n.data.label === hop.componentName,
      );
      if (!matchingNode) return;

      if (index === 0) {
        roleMap.set(matchingNode.id, "entry");
      } else if (index === chain.hops.length - 1) {
        roleMap.set(matchingNode.id, "target");
      } else if (!roleMap.has(matchingNode.id)) {
        roleMap.set(matchingNode.id, "intermediate");
      }
    });

    // Also mark entry/target by ID fields if hops didn't resolve them
    const entryNode = nodes.find(
      (n) =>
        n.id === chain.entryPointId || n.data.label === chain.entryPointName,
    );
    const targetNode = nodes.find(
      (n) =>
        n.id === chain.targetAssetId || n.data.label === chain.targetAssetName,
    );
    if (entryNode) roleMap.set(entryNode.id, "entry");
    if (targetNode) roleMap.set(targetNode.id, "target");

    // Apply highlights
    nodes.forEach((node) => {
      const role = roleMap.get(node.id);
      const current = node.data.chainHighlight;
      if (role && current !== role) {
        updateNodeData(node.id, { chainHighlight: role });
      } else if (!role && current) {
        updateNodeData(node.id, { chainHighlight: undefined });
      }
    });

    // Cleanup on unmount or chain change
    return () => {
      nodes.forEach((node) => {
        if (node.data.chainHighlight) {
          updateNodeData(node.id, { chainHighlight: undefined });
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain?.id]);

  // This component has no visual output — it drives canvas state as a side-effect.
  return null;
}
