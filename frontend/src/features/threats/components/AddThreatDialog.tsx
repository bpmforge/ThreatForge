"use client";

/**
 * AddThreatDialog - Dialog for creating new threats.
 */
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { StrideCategory, Severity } from "@/types/canvas";
import { STRIDE_CATEGORIES, SEVERITY_OPTIONS } from "../constants";
import { CategorySelect } from "./CategorySelect";
import { SeverityCalculator } from "@/features/threat-assist";

interface AddThreatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLabel?: string;
  /** Existing categories for autocomplete */
  existingCategories?: string[];
  onSubmit: (data: {
    name: string;
    description?: string;
    strideCategories: StrideCategory[];
    severity: Severity;
    category?: string;
  }) => void;
}

export function AddThreatDialog({
  open,
  onOpenChange,
  selectedLabel,
  existingCategories = [],
  onSubmit,
}: AddThreatDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [strideCategories, setStrideCategories] = useState<StrideCategory[]>(
    [],
  );
  const [severity, setSeverity] = useState<Severity>("MEDIUM");
  const [category, setCategory] = useState("");

  const toggleStrideCategory = (cat: StrideCategory) => {
    setStrideCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleSubmit = () => {
    onSubmit({
      name,
      description: description || undefined,
      strideCategories,
      severity,
      category: category || undefined,
    });
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setStrideCategories([]);
    setSeverity("MEDIUM");
    setCategory("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          + Add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Threat</DialogTitle>
          <DialogDescription>
            Create a new threat{selectedLabel ? ` for ${selectedLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="threat-name">Threat Name</Label>
            <Input
              id="threat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., SQL Injection"
            />
          </div>

          <div className="space-y-2">
            <Label>STRIDE Categories (select all that apply)</Label>
            <div className="grid grid-cols-2 gap-2">
              {STRIDE_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => toggleStrideCategory(cat.value)}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    strideCategories.includes(cat.value)
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                        strideCategories.includes(cat.value)
                          ? "bg-blue-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {cat.short}
                    </span>
                    <span className="text-sm font-medium">{cat.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-8">
                    {cat.description}
                  </p>
                </button>
              ))}
            </div>
            {strideCategories.length === 0 && (
              <p className="text-xs text-amber-600">
                Select at least one category
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="severity">Severity</Label>
            <Select
              value={severity}
              onValueChange={(v) => setSeverity(v as Severity)}
            >
              <SelectTrigger id="severity">
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((sev) => (
                  <SelectItem key={sev.value} value={sev.value}>
                    {sev.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Severity Calculator - Collapsible */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                >
                  <ChevronRight className="h-3 w-3 mr-1 transition-transform [[data-state=open]_&]:rotate-90" />
                  Need help choosing? Use severity calculator
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <SeverityCalculator
                  onSeveritySelect={(sev) =>
                    setSeverity(sev.toUpperCase() as Severity)
                  }
                  initialSeverity={
                    severity.toLowerCase() as
                      | "low"
                      | "medium"
                      | "high"
                      | "critical"
                  }
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Category selector with predefined options */}
          <CategorySelect
            value={category}
            onChange={setCategory}
            existingCategories={existingCategories}
            optional
          />

          {/* Description - Textarea for detailed input */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the threat, attack vectors, and potential impact..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || strideCategories.length === 0}
          >
            Add Threat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
