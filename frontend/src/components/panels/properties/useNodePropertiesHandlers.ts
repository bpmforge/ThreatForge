"use client";

import { useCallback } from "react";
import type { Node } from "@xyflow/react";
import type {
  ComponentType,
  TrustLevel,
  ComponentStyle,
  ComponentInterface,
  InterfaceDirection,
  ComponentNodeData,
  BoundaryNodeData,
} from "@/types/canvas";
import { generateInterfacesFromPreset } from "@/constants/interface-presets";

export function useNodePropertiesHandlers(
  node: Node,
  data: ComponentNodeData | BoundaryNodeData,
  onUpdate: (
    id: string,
    data: Partial<ComponentNodeData | BoundaryNodeData>,
  ) => void,
) {
  const handleLabelChange = useCallback(
    // Editing the plain name replaces any rich label so the two never diverge.
    (value: string) =>
      onUpdate(node.id, { label: value, richLabel: undefined } as Partial<
        ComponentNodeData | BoundaryNodeData
      >),
    [node.id, onUpdate],
  );

  const handleDescriptionChange = useCallback(
    (value: string) => onUpdate(node.id, { description: value || undefined }),
    [node.id, onUpdate],
  );

  const handleTypeChange = useCallback(
    (value: ComponentType) => onUpdate(node.id, { type: value }),
    [node.id, onUpdate],
  );

  const handleTrustLevelChange = useCallback(
    (value: TrustLevel) => onUpdate(node.id, { trustLevel: value }),
    [node.id, onUpdate],
  );

  const handleStyleChange = useCallback(
    (style: Partial<ComponentStyle>) => {
      const currentStyle = (data as ComponentNodeData).style || {};
      onUpdate(node.id, { style: { ...currentStyle, ...style } });
    },
    [node.id, data, onUpdate],
  );

  const handleResetStyle = useCallback(() => {
    onUpdate(node.id, { style: undefined });
  }, [node.id, onUpdate]);

  const handleOpacityChange = useCallback(
    (value: number[]) => onUpdate(node.id, { opacity: value[0] }),
    [node.id, onUpdate],
  );

  const handleApplyPreset = useCallback(() => {
    const compData = data as ComponentNodeData;
    const interfaces = generateInterfacesFromPreset(compData.type);
    onUpdate(node.id, { interfaces });
  }, [node.id, data, onUpdate]);

  const handleAddInterface = useCallback(() => {
    const compData = data as ComponentNodeData;
    const currentInterfaces = compData.interfaces || [];
    const newInterface: ComponentInterface = {
      id: `iface-${Date.now()}`,
      name: `Interface ${currentInterfaces.length + 1}`,
      direction: "ingress" as InterfaceDirection,
      position: "left",
      protocol: "HTTPS",
      authentication: "None",
      encrypted: true,
    };
    onUpdate(node.id, { interfaces: [...currentInterfaces, newInterface] });
  }, [node.id, data, onUpdate]);

  const handleRemoveInterface = useCallback(
    (interfaceId: string) => {
      const compData = data as ComponentNodeData;
      const updated = (compData.interfaces || []).filter(
        (i) => i.id !== interfaceId,
      );
      onUpdate(node.id, { interfaces: updated });
    },
    [node.id, data, onUpdate],
  );

  const handleUpdateInterface = useCallback(
    (interfaceId: string, updates: Partial<ComponentInterface>) => {
      const compData = data as ComponentNodeData;
      const updated = (compData.interfaces || []).map((i) =>
        i.id === interfaceId ? { ...i, ...updates } : i,
      );
      onUpdate(node.id, { interfaces: updated });
    },
    [node.id, data, onUpdate],
  );

  const handleSetCustomIcon = useCallback(
    (dataUrl: string) => onUpdate(node.id, { customIcon: dataUrl }),
    [node.id, onUpdate],
  );

  const handleClearCustomIcon = useCallback(
    () => onUpdate(node.id, { customIcon: undefined }),
    [node.id, onUpdate],
  );

  return {
    handleLabelChange,
    handleDescriptionChange,
    handleTypeChange,
    handleTrustLevelChange,
    handleStyleChange,
    handleResetStyle,
    handleOpacityChange,
    handleApplyPreset,
    handleAddInterface,
    handleRemoveInterface,
    handleUpdateInterface,
    handleSetCustomIcon,
    handleClearCustomIcon,
  };
}
