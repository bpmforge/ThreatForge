"use client";

/**
 * SecurityChipGroup
 *
 * A labelled group of toggleable chip buttons used by the Security Context
 * panel (data types, compliance frameworks, existing controls).
 */

import { Button } from "@/components/ui/button";

interface SecurityChipGroupProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (item: string) => void;
  /** Optional override class applied to selected chips (defaults to "default" variant). */
  selectedClassName?: string;
}

export function SecurityChipGroup({
  label,
  options,
  selected,
  onToggle,
  selectedClassName,
}: SecurityChipGroupProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex flex-wrap gap-1">
        {options.map((item) => {
          const isSelected = selected.includes(item);
          // When a custom selected style is supplied, keep the outline base.
          const variant =
            selectedClassName === undefined && isSelected
              ? "default"
              : "outline";
          return (
            <Button
              key={item}
              variant={variant}
              size="sm"
              onClick={() => onToggle(item)}
              className={`text-[10px] px-2 py-1 h-auto rounded-full ${
                selectedClassName && isSelected ? selectedClassName : ""
              }`}
            >
              {item}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
