"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";
import type {
  ComponentType,
  TrustLevel,
  ComponentNodeData,
  BoundaryNodeData,
} from "@/types/canvas";
import { Section } from "./Section";
import { NodeStatusSection } from "./NodeStatusSection";
import { componentTypeGroups, trustLevels } from "./constants";
import { RichLabelEditor } from "./RichLabelEditor";
import { normalizeRichLabel, richLabelToPlainText } from "@/lib/rich-label";

interface BasicInfoSectionProps {
  nodeId: string;
  data: ComponentNodeData | BoundaryNodeData;
  isComponent: boolean;
  onLabelChange: (value: string) => void;
  onTypeChange: (value: ComponentType) => void;
  onTrustLevelChange: (value: TrustLevel) => void;
  onDescriptionChange: (value: string) => void;
  onUpdate: (
    id: string,
    data: Partial<ComponentNodeData | BoundaryNodeData>,
  ) => void;
}

export function BasicInfoSection({
  nodeId,
  data,
  isComponent,
  onLabelChange,
  onTypeChange,
  onTrustLevelChange,
  onDescriptionChange,
  onUpdate,
}: BasicInfoSectionProps) {
  const compData = data as ComponentNodeData;
  const ext = (data as Record<string, unknown>)._extraction as
    | Record<string, string>
    | undefined;

  return (
    <Section title="Basic Info" icon={Info} defaultOpen={true}>
      <div className="space-y-2">
        <Label htmlFor="label" className="text-xs">
          Name
        </Label>
        <Input
          id="label"
          value={data.label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="Enter name..."
          className="h-8 text-sm"
        />
      </div>

      {isComponent && (
        <RichLabelEditor
          value={compData.richLabel ?? ""}
          onChange={(v) =>
            onUpdate(nodeId, {
              richLabel: normalizeRichLabel(v) === undefined ? undefined : v,
              // plain `label` stays the fallback for old clients/exports
              label: richLabelToPlainText(v) || compData.label,
            } as Partial<ComponentNodeData>)
          }
        />
      )}

      {isComponent && (
        <div className="space-y-2">
          <Label htmlFor="type" className="text-xs">
            Type
          </Label>
          <Select value={compData.type} onValueChange={onTypeChange}>
            <SelectTrigger id="type" className="h-8 text-sm">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent className="max-h-96">
              {componentTypeGroups.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.options.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="trustLevel" className="text-xs">
          Trust Level
        </Label>
        <Select value={data.trustLevel} onValueChange={onTrustLevelChange}>
          <SelectTrigger id="trustLevel" className="h-8 text-sm">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {trustLevels.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                {level.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-xs">
          Description
        </Label>
        <Input
          id="description"
          value={data.description || ""}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Optional..."
          className="h-8 text-sm"
        />
      </div>

      {isComponent && ext?.aiNotes && (
        <div className="space-y-1">
          <Label className="text-xs text-violet-600">AI Notes</Label>
          <p className="text-xs text-muted-foreground bg-violet-50 dark:bg-violet-950 rounded p-2 whitespace-pre-wrap">
            {ext.aiNotes}
          </p>
        </div>
      )}

      {isComponent && (
        <NodeStatusSection
          nodeId={nodeId}
          status={compData.status}
          onUpdate={(status) =>
            onUpdate(nodeId, { status } as Partial<ComponentNodeData>)
          }
        />
      )}

      {isComponent && (
        <div className="space-y-1">
          <Label htmlFor="engineer-notes" className="text-xs">
            Engineer Notes
          </Label>
          <textarea
            id="engineer-notes"
            value={
              ((data as Record<string, unknown>).engineerNotes as string) || ""
            }
            onChange={(e) =>
              onUpdate(nodeId, {
                engineerNotes: e.target.value || undefined,
              })
            }
            placeholder="Your observations, decisions, rationale..."
            className="w-full min-h-[60px] text-xs rounded-md border border-input bg-background px-2 py-1.5 resize-y"
            rows={3}
          />
        </div>
      )}
    </Section>
  );
}
