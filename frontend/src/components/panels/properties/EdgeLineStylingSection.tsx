"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RotateCcw, Palette } from "lucide-react";
import type {
  EdgeStyle,
  EdgeStyleOptions,
  ConnectionData,
} from "@/types/canvas";
import { Section } from "./Section";
import { colorPresets, edgeLineStyles } from "./constants";

const endpointStyles: { value: string; label: string }[] = [
  { value: "none", label: "None" },
  { value: "arrow", label: "Arrow (default)" },
  { value: "arrow-open", label: "Arrow open" },
  { value: "diamond", label: "Diamond" },
  { value: "circle", label: "Circle" },
  { value: "tee", label: "Tee (mTLS)" },
  { value: "cross", label: "Cross" },
];

interface EdgeLineStylingProps {
  edgeId: string;
  data: ConnectionData;
  onStyleChange: (style: Partial<EdgeStyleOptions>) => void;
  onResetStyle: () => void;
  onUpdate: (id: string, data: Partial<ConnectionData>) => void;
}

export function EdgeLineStylingSection({
  edgeId,
  data,
  onStyleChange,
  onResetStyle,
  onUpdate,
}: EdgeLineStylingProps) {
  return (
    <Section
      title="Line Style"
      icon={Palette}
      defaultOpen={true}
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetStyle}
          className="h-6 w-6 p-0"
          title="Reset"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      }
    >
      <div className="space-y-2">
        <Label className="text-xs">Shape</Label>
        <Select
          value={data.style?.lineStyle || "bezier"}
          onValueChange={(v) => onStyleChange({ lineStyle: v as EdgeStyle })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {edgeLineStyles.map((style) => (
              <SelectItem key={style.value} value={style.value}>
                {style.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Thickness</Label>
        <Select
          value={String(data.style?.strokeWidth || 2)}
          onValueChange={(v) => onStyleChange({ strokeWidth: parseInt(v) })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Thin</SelectItem>
            <SelectItem value="2">Normal</SelectItem>
            <SelectItem value="3">Medium</SelectItem>
            <SelectItem value="4">Thick</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Color</Label>
        <div className="flex flex-wrap gap-1">
          {colorPresets.map((color) => (
            <button
              key={color.name}
              type="button"
              className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: color.border }}
              title={color.name}
              onClick={() => onStyleChange({ strokeColor: color.border })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Stroke</Label>
        <Select
          value={data.strokePattern ?? "auto"}
          onValueChange={(v) =>
            onUpdate(edgeId, {
              strokePattern:
                v === "auto" ? undefined : (v as "solid" | "dashed" | "dotted"),
            })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto (from encrypted)</SelectItem>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="dashed">Dashed</SelectItem>
            <SelectItem value="dotted">Dotted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(data.style?.lineStyle === "step" ||
        data.style?.lineStyle === "smoothstep" ||
        !data.style?.lineStyle) && (
        <div className="space-y-2">
          <Label className="text-xs">
            Corner radius: {data.cornerRadius ?? 0}px
          </Label>
          <input
            type="range"
            min={0}
            max={20}
            step={2}
            value={data.cornerRadius ?? 0}
            className="w-full h-1.5 accent-blue-500"
            onChange={(e) =>
              onUpdate(edgeId, { cornerRadius: parseInt(e.target.value) })
            }
            aria-label="Corner radius"
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label htmlFor="line-double" className="text-xs font-normal">
          Double line
        </Label>
        <Switch
          id="line-double"
          checked={data.lineVariant === "double"}
          onCheckedChange={(checked) =>
            onUpdate(edgeId, { lineVariant: checked ? "double" : "single" })
          }
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Start arrowhead</Label>
        <Select
          value={data.endpoint?.start ?? "none"}
          onValueChange={(v) =>
            onUpdate(edgeId, {
              endpoint: {
                ...data.endpoint,
                start: v as import("@/types/canvas").EndpointStyle,
              },
            })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {endpointStyles.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">End arrowhead</Label>
        <Select
          value={data.endpoint?.end ?? "arrow"}
          onValueChange={(v) =>
            onUpdate(edgeId, {
              endpoint: {
                ...data.endpoint,
                end: v as import("@/types/canvas").EndpointStyle,
              },
            })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {endpointStyles.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Section>
  );
}
