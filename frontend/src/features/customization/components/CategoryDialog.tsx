"use client";

/**
 * Category Create/Edit Dialog
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  useCreateCategory,
  useUpdateCategory,
} from "../hooks/useCustomCategories";
import type { CustomThreatCategory, CreateCategoryData } from "../types";

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
];

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  category: CustomThreatCategory | null;
}

export function CategoryDialog({
  open,
  onOpenChange,
  orgId,
  category,
}: CategoryDialogProps) {
  const createCategory = useCreateCategory(orgId);
  const updateCategory = useUpdateCategory(orgId);

  // Local overrides - null means use original value
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [descOverride, setDescOverride] = useState<string | null>(null);
  const [colorOverride, setColorOverride] = useState<string | null>(null);
  const [activeOverride, setActiveOverride] = useState<boolean | null>(null);

  const isEditing = !!category;

  // Derived values: use override if user edited, otherwise use category or default
  const name = nameOverride ?? category?.name ?? "";
  const description = descOverride ?? category?.description ?? "";
  const color = colorOverride ?? category?.color ?? PRESET_COLORS[0];
  const isActive = activeOverride ?? category?.isActive ?? true;

  // Reset overrides when dialog closes or category changes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setNameOverride(null);
      setDescOverride(null);
      setColorOverride(null);
      setActiveOverride(null);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;

    const data: CreateCategoryData = {
      name: name.trim(),
      description: description.trim() || undefined,
      color,
    };

    const onSuccess = () => onOpenChange(false);

    if (isEditing) {
      updateCategory.mutate(
        { categoryId: category.id, data: { ...data, isActive } },
        { onSuccess },
      );
    } else {
      createCategory.mutate(data, { onSuccess });
    }
  };

  const isPending = createCategory.isPending || updateCategory.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Category" : "Create Category"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the category details below"
              : "Create a new custom threat category for your organization"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setNameOverride(e.target.value)}
              placeholder="e.g., Data Privacy, Compliance, API Security"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescOverride(e.target.value)}
              placeholder="Describe when to use this category..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColorOverride(presetColor)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === presetColor
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: presetColor }}
                />
              ))}
            </div>
          </div>

          {isEditing && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="active">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive categories won&apos;t appear in dropdowns
                </p>
              </div>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setActiveOverride}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Create Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
