/**
 * Library Form component for Component Template Manager.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { ComponentTemplateLibrary } from "../types";

interface LibraryFormProps {
  library: ComponentTemplateLibrary | null;
  onSubmit: (data: {
    name: string;
    description?: string;
    isPublic?: boolean;
  }) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function LibraryForm({
  library,
  onSubmit,
  onCancel,
  isLoading,
}: LibraryFormProps) {
  const [name, setName] = useState(library?.name ?? "");
  const [description, setDescription] = useState(library?.description ?? "");
  const [isPublic, setIsPublic] = useState(library?.isPublic ?? false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description: description || undefined, isPublic });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lib-name">Name</Label>
        <Input
          id="lib-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Component Library"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lib-description">Description</Label>
        <Textarea
          id="lib-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          rows={3}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="lib-public"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="rounded"
        />
        <Label htmlFor="lib-public" className="font-normal">
          Make this library public (visible to other organizations)
        </Label>
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name || isLoading}>
          {library ? "Update" : "Create"} Library
        </Button>
      </div>
    </form>
  );
}
