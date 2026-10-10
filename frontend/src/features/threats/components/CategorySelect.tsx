"use client";

/**
 * CategorySelect - Select predefined category or enter custom one.
 * Shows predefined categories + any custom categories from existing threats.
 */
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_THREAT_CATEGORIES } from "../constants";

const CUSTOM_VALUE = "__CUSTOM__";
const NONE_VALUE = "__NONE__";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  /** Categories already used in this model (for showing custom ones) */
  existingCategories?: string[];
  /** Label for the field */
  label?: string;
  /** Whether the field is optional */
  optional?: boolean;
}

export function CategorySelect({
  value,
  onChange,
  existingCategories = [],
  label = "Category",
  optional = false,
}: CategorySelectProps) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");

  // Combine predefined + custom categories (excluding predefined ones from existing)
  const allCategories = useMemo(() => {
    const predefined = new Set(DEFAULT_THREAT_CATEGORIES);
    const customFromExisting = existingCategories.filter(
      (c) => !predefined.has(c as (typeof DEFAULT_THREAT_CATEGORIES)[number]),
    );
    return {
      predefined: [...DEFAULT_THREAT_CATEGORIES],
      custom: customFromExisting,
    };
  }, [existingCategories]);

  // Determine if current value is a predefined category
  const isPredefined = DEFAULT_THREAT_CATEGORIES.includes(
    value as (typeof DEFAULT_THREAT_CATEGORIES)[number],
  );
  const isCustom = value && !isPredefined;

  // Get select value - either the category, CUSTOM for custom mode, or NONE
  const selectValue = isCustomMode
    ? CUSTOM_VALUE
    : value
      ? isPredefined
        ? value
        : CUSTOM_VALUE
      : NONE_VALUE;

  const handleSelectChange = (newValue: string) => {
    if (newValue === CUSTOM_VALUE) {
      setIsCustomMode(true);
      setCustomValue(isCustom ? value : "");
    } else if (newValue === NONE_VALUE) {
      setIsCustomMode(false);
      onChange("");
    } else {
      setIsCustomMode(false);
      onChange(newValue);
    }
  };

  const handleCustomSave = () => {
    if (customValue.trim()) {
      onChange(customValue.trim());
      setIsCustomMode(false);
    }
  };

  const handleCustomCancel = () => {
    setIsCustomMode(false);
    setCustomValue("");
    // Keep the previous value if it was custom
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {optional && " (optional)"}
      </Label>

      {isCustomMode ? (
        <div className="flex gap-2">
          <Input
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Enter custom category..."
            className="flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCustomSave();
              } else if (e.key === "Escape") {
                handleCustomCancel();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleCustomSave}
            disabled={!customValue.trim()}
          >
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCustomCancel}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Select value={selectValue} onValueChange={handleSelectChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a category">
              {isCustom ? value : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {optional && (
              <SelectItem value={NONE_VALUE}>
                <span className="text-muted-foreground">None</span>
              </SelectItem>
            )}

            {/* Predefined categories */}
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Standard Categories
            </div>
            {allCategories.predefined.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}

            {/* Custom categories from existing threats */}
            {allCategories.custom.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                  Custom Categories
                </div>
                {allCategories.custom.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </>
            )}

            {/* Add custom option */}
            <div className="border-t mt-1 pt-1">
              <SelectItem value={CUSTOM_VALUE}>
                <span className="text-primary">+ Add custom category...</span>
              </SelectItem>
            </div>
          </SelectContent>
        </Select>
      )}

      {isCustom && !isCustomMode && (
        <p className="text-xs text-muted-foreground">
          Custom category: {value}
        </p>
      )}
    </div>
  );
}
