"use client";

import { useCallback } from "react";
import type { Edge, Node } from "@xyflow/react";
import type {
  Protocol,
  AuthMethod,
  DataClassification,
  EdgeStyleOptions,
  ConnectionData,
  ComponentNodeData,
} from "@/types/canvas";

export function useEdgeProperties(
  edge: Edge,
  nodes: Node[],
  onUpdate: (id: string, data: Partial<ConnectionData>) => void,
) {
  const data = (edge.data || {}) as ConnectionData;
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);
  const sourceLabel =
    (sourceNode?.data as ComponentNodeData)?.label || "Unknown";
  const targetLabel =
    (targetNode?.data as ComponentNodeData)?.label || "Unknown";

  const handleLabelChange = useCallback(
    (value: string) => onUpdate(edge.id, { label: value || undefined }),
    [edge.id, onUpdate],
  );

  const handleProtocolChange = useCallback(
    (value: Protocol) => onUpdate(edge.id, { protocol: value }),
    [edge.id, onUpdate],
  );

  const handleAuthChange = useCallback(
    (value: AuthMethod) => onUpdate(edge.id, { authentication: value }),
    [edge.id, onUpdate],
  );

  const handleDataClassificationToggle = useCallback(
    (classification: DataClassification, checked: boolean) => {
      const current = data.dataClassifications || [];
      const updated = checked
        ? [...current, classification]
        : current.filter((c) => c !== classification);
      onUpdate(edge.id, { dataClassifications: updated });
    },
    [edge.id, data.dataClassifications, onUpdate],
  );

  const handleEncryptedChange = useCallback(
    (checked: boolean) => onUpdate(edge.id, { encrypted: checked }),
    [edge.id, onUpdate],
  );

  const handleAuthenticatedChange = useCallback(
    (checked: boolean) => onUpdate(edge.id, { authenticated: checked }),
    [edge.id, onUpdate],
  );

  const handleStyleChange = useCallback(
    (style: Partial<EdgeStyleOptions>) => {
      const currentStyle = data.style || {};
      onUpdate(edge.id, { style: { ...currentStyle, ...style } });
    },
    [edge.id, data.style, onUpdate],
  );

  const handleResetStyle = useCallback(() => {
    onUpdate(edge.id, { style: undefined });
  }, [edge.id, onUpdate]);

  return {
    data,
    sourceLabel,
    targetLabel,
    handleLabelChange,
    handleProtocolChange,
    handleAuthChange,
    handleDataClassificationToggle,
    handleEncryptedChange,
    handleAuthenticatedChange,
    handleStyleChange,
    handleResetStyle,
  };
}
