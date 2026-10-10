"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FactorSelectProps {
  label: string;
  description: string;
  options: readonly { value: number; label: string }[];
  value: number;
  onChange: (value: number) => void;
  readonly?: boolean;
}

export function FactorSelect({
  label,
  description,
  options,
  value,
  onChange,
  readonly,
}: FactorSelectProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-[10px] text-muted-foreground">{value}/9</span>
      </div>
      <Select
        value={String(value)}
        onValueChange={(v) => onChange(parseInt(v, 10))}
        disabled={readonly}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={String(opt.value)}
              className="text-xs"
            >
              <span className="inline-flex items-center gap-2">
                <span className="text-muted-foreground">[{opt.value}]</span>
                {opt.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[10px] text-muted-foreground">{description}</p>
    </div>
  );
}
