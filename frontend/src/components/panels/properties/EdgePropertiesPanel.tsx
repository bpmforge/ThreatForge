"use client";

import type { Edge, Node } from "@xyflow/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Info, Shield, Palette } from "lucide-react";
import type { Protocol, AuthMethod, ConnectionData } from "@/types/canvas";
import { Section } from "./Section";
import { protocols, authMethods, dataClassifications } from "./constants";
import { useEdgeProperties } from "./useEdgeProperties";
import { EdgeLineStylingSection } from "./EdgeLineStylingSection";

interface EdgePropertiesPanelProps {
  edge: Edge;
  nodes: Node[];
  onUpdate: (id: string, data: Partial<ConnectionData>) => void;
}

export function EdgePropertiesPanel({
  edge,
  nodes,
  onUpdate,
}: EdgePropertiesPanelProps) {
  const {
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
  } = useEdgeProperties(edge, nodes, onUpdate);

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden">
      <div className="p-3 border-b shrink-0">
        <h2 className="font-semibold text-foreground text-sm">Properties</h2>
        <p className="text-xs text-muted-foreground">Connection / Data Flow</p>
      </div>

      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="p-3 border-b border-border w-full">
          <div className="p-2 bg-muted/50 rounded text-xs">
            <div className="text-muted-foreground">From:</div>
            <div className="font-medium truncate">{sourceLabel}</div>
            <div className="text-muted-foreground mt-1">To:</div>
            <div className="font-medium truncate">{targetLabel}</div>
          </div>
        </div>

        <Section title="Basic Info" icon={Info} defaultOpen={true}>
          <div className="space-y-2">
            <Label htmlFor="edge-label" className="text-xs">
              Label
            </Label>
            <Input
              id="edge-label"
              value={data.label || ""}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="e.g., API Request"
              className="h-8 text-sm"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <Label htmlFor="edge-start-label" className="text-xs">
                  Start label
                </Label>
                <Input
                  id="edge-start-label"
                  value={data.startLabel || ""}
                  onChange={(e) =>
                    onUpdate(edge.id, {
                      startLabel: e.target.value || undefined,
                    })
                  }
                  placeholder="e.g., 1"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="edge-end-label" className="text-xs">
                  End label
                </Label>
                <Input
                  id="edge-end-label"
                  value={data.endLabel || ""}
                  onChange={(e) =>
                    onUpdate(edge.id, { endLabel: e.target.value || undefined })
                  }
                  placeholder="e.g., n"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        </Section>

        <EdgeLineStylingSection
          edgeId={edge.id}
          data={data}
          onStyleChange={handleStyleChange}
          onResetStyle={handleResetStyle}
          onUpdate={onUpdate}
        />

        <Section title="Protocol" icon={Shield} defaultOpen={false}>
          <div className="space-y-2">
            <Label className="text-xs">Protocol</Label>
            <Select
              value={data.protocol || ""}
              onValueChange={(v) => handleProtocolChange(v as Protocol)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {protocols.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Authentication</Label>
            <Select
              value={data.authentication || ""}
              onValueChange={(v) => handleAuthChange(v as AuthMethod)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {authMethods.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Section>

        <Section title="Security" icon={Shield} defaultOpen={false}>
          <div className="flex items-center justify-between">
            <Label htmlFor="encrypted" className="text-xs font-normal">
              Encrypted (TLS)
            </Label>
            <Switch
              id="encrypted"
              checked={data.encrypted || false}
              onCheckedChange={handleEncryptedChange}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="authenticated" className="text-xs font-normal">
              Authenticated
            </Label>
            <Switch
              id="authenticated"
              checked={data.authenticated || false}
              onCheckedChange={handleAuthenticatedChange}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Data Classification</Label>
            <div className="space-y-1">
              {dataClassifications.map((dc) => {
                const isSelected =
                  data.dataClassifications?.includes(dc.value) ?? false;
                return (
                  <div
                    key={dc.value}
                    className="flex items-center justify-between"
                  >
                    <Label
                      htmlFor={`dc-${dc.value}`}
                      className="text-xs font-normal"
                    >
                      {dc.label}
                    </Label>
                    <Switch
                      id={`dc-${dc.value}`}
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleDataClassificationToggle(dc.value, checked)
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="Label" icon={Palette} defaultOpen={false}>
          <div className="space-y-2">
            <Label className="text-xs">Position</Label>
            <Select
              value={data.labelOffset ?? "center"}
              onValueChange={(v) =>
                onUpdate(edge.id, {
                  labelOffset: v as "above" | "center" | "below",
                })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="above">Above path</SelectItem>
                <SelectItem value="center">On path (default)</SelectItem>
                <SelectItem value="below">Below path</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Size</Label>
            <Select
              value={data.labelSize ?? "sm"}
              onValueChange={(v) =>
                onUpdate(edge.id, {
                  labelSize: v as "xs" | "sm" | "md" | "lg",
                })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xs">XS — tiny</SelectItem>
                <SelectItem value="sm">S — small (default)</SelectItem>
                <SelectItem value="md">M — medium</SelectItem>
                <SelectItem value="lg">L — large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Section>
      </ScrollArea>
    </div>
  );
}
