"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Eye } from "lucide-react";
import type { BoundaryNodeData } from "@/types/canvas";
import { Section } from "./Section";

interface AppearanceSectionProps {
  data: BoundaryNodeData;
  onOpacityChange: (value: number[]) => void;
}

export function AppearanceSection({
  data,
  onOpacityChange,
}: AppearanceSectionProps) {
  return (
    <Section title="Appearance" icon={Eye} defaultOpen={true}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Opacity</Label>
          <span className="text-xs text-muted-foreground">
            {data.opacity ?? 30}%
          </span>
        </div>
        <Slider
          value={[data.opacity ?? 30]}
          onValueChange={onOpacityChange}
          min={10}
          max={80}
          step={5}
          className="w-full"
        />
        <p className="text-[10px] text-muted-foreground">
          Lower = more transparent
        </p>
      </div>
    </Section>
  );
}
