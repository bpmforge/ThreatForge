"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paintbrush, RotateCcw } from "lucide-react";
import type { ComponentNodeData, ComponentStyle } from "@/types/canvas";
import { Section } from "./Section";
import { colorPresets, fontSizes } from "./constants";

interface StylingSectionProps {
  data: ComponentNodeData;
  onStyleChange: (style: Partial<ComponentStyle>) => void;
  onResetStyle: () => void;
}

export function StylingSection({
  data,
  onStyleChange,
  onResetStyle,
}: StylingSectionProps) {
  return (
    <Section
      title="Styling"
      icon={Paintbrush}
      defaultOpen={false}
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
        <Label className="text-xs">Quick Colors</Label>
        <div className="flex flex-wrap gap-1">
          {colorPresets.map((color) => (
            <button
              key={color.name}
              type="button"
              className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: color.bg }}
              title={color.name}
              onClick={() =>
                onStyleChange({
                  backgroundColor: color.bg,
                  borderColor: color.border,
                  textColor: color.text,
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Custom Colors</Label>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Fill</Label>
            <Input
              type="color"
              value={data.style?.backgroundColor || "#ffffff"}
              onChange={(e) =>
                onStyleChange({ backgroundColor: e.target.value })
              }
              className="h-7 w-full cursor-pointer p-0"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Border</Label>
            <Input
              type="color"
              value={data.style?.borderColor || "#000000"}
              onChange={(e) => onStyleChange({ borderColor: e.target.value })}
              className="h-7 w-full cursor-pointer p-0"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Text</Label>
            <Input
              type="color"
              value={data.style?.textColor || "#000000"}
              onChange={(e) => onStyleChange({ textColor: e.target.value })}
              className="h-7 w-full cursor-pointer p-0"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Font Size</Label>
        <Select
          value={data.style?.fontSize || "sm"}
          onValueChange={(v) =>
            onStyleChange({ fontSize: v as ComponentStyle["fontSize"] })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fontSizes.map((size) => (
              <SelectItem key={size.value} value={size.value}>
                {size.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Section>
  );
}
