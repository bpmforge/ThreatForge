"use client";

import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAnalysisStatus } from "@/features/ai/hooks/useAnalysisStatus";
import { SecurityContextPanel } from "@/features/threats/components/SecurityContextPanel";
import type { ComponentNodeData, BoundaryNodeData } from "@/types/canvas";
import { Section } from "./Section";
import { useNodePropertiesHandlers } from "./useNodePropertiesHandlers";
import { BasicInfoSection } from "./BasicInfoSection";
import { AppearanceSection } from "./AppearanceSection";
import { InterfacesSection } from "./InterfacesSection";
import { StylingSection } from "./StylingSection";
import { NodeIconSection } from "./NodeIconSection";

interface NodePropertiesPanelProps {
  node: Node;
  onUpdate: (
    id: string,
    data: Partial<ComponentNodeData | BoundaryNodeData>,
  ) => void;
  modelId?: string;
}

export function NodePropertiesPanel({
  node,
  onUpdate,
  modelId,
}: NodePropertiesPanelProps) {
  const isComponent = node.type === "component";
  const data = node.data as ComponentNodeData | BoundaryNodeData;

  const { data: analysisStatus } = useAnalysisStatus(
    modelId && isComponent ? modelId : null,
  );
  const componentInfo = useMemo(
    () => analysisStatus?.components.find((c) => c.nodeId === node.id) ?? null,
    [analysisStatus, node.id],
  );

  const {
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
  } = useNodePropertiesHandlers(node, data, onUpdate);

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden">
      <div className="p-3 border-b shrink-0">
        <h2 className="font-semibold text-foreground text-sm">Properties</h2>
        <p className="text-xs text-muted-foreground">
          {isComponent ? "Component" : "Trust Boundary"}
        </p>
        {isComponent && componentInfo !== null && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px]">
            {componentInfo.analyzedAt ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                <span className="text-muted-foreground">
                  Analyzed{" "}
                  {new Date(componentInfo.analyzedAt).toLocaleString(
                    undefined,
                    { dateStyle: "short", timeStyle: "short" },
                  )}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
                <span className="text-yellow-700">
                  Not yet analyzed — run AI analysis to include this component
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0 w-full">
        <BasicInfoSection
          nodeId={node.id}
          data={data}
          isComponent={isComponent}
          onLabelChange={handleLabelChange}
          onTypeChange={handleTypeChange}
          onTrustLevelChange={handleTrustLevelChange}
          onDescriptionChange={handleDescriptionChange}
          onUpdate={onUpdate}
        />

        {!isComponent && (
          <AppearanceSection
            data={data as BoundaryNodeData}
            onOpacityChange={handleOpacityChange}
          />
        )}

        {isComponent && (
          <InterfacesSection
            data={data as ComponentNodeData}
            onAddInterface={handleAddInterface}
            onApplyPreset={handleApplyPreset}
            onRemoveInterface={handleRemoveInterface}
            onUpdateInterface={handleUpdateInterface}
          />
        )}

        {isComponent && (
          <NodeIconSection
            data={data as ComponentNodeData}
            onSetIcon={handleSetCustomIcon}
            onClearIcon={handleClearCustomIcon}
          />
        )}

        {isComponent && (
          <StylingSection
            data={data as ComponentNodeData}
            onStyleChange={handleStyleChange}
            onResetStyle={handleResetStyle}
          />
        )}

        {isComponent && (
          <Section title="Security Context" icon={Shield} defaultOpen={false}>
            <SecurityContextPanel
              value={
                (data as ComponentNodeData).securityContext || {
                  dataClassification: "INTERNAL",
                  dataTypes: [],
                  accessPattern: "AUTHENTICATED_USERS",
                  complianceFrameworks: [],
                  existingControls: [],
                }
              }
              onChange={(ctx) =>
                onUpdate(node.id, {
                  securityContext: ctx,
                } as Partial<ComponentNodeData>)
              }
              componentType={(data as ComponentNodeData).type}
            />
          </Section>
        )}
      </ScrollArea>
    </div>
  );
}
