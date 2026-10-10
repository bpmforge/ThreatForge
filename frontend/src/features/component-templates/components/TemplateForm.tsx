/**
 * Template Form component for Component Template Manager.
 */
"use client";

import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { COMPONENT_TYPE_OPTIONS } from "./constants";
import type {
  ComponentTemplate,
  ComponentType,
  CreateTemplateRequest,
} from "../types";

interface TemplateFormProps {
  template: ComponentTemplate | null;
  onSubmit: (data: CreateTemplateRequest) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function TemplateForm({
  template,
  onSubmit,
  onCancel,
  isLoading,
}: TemplateFormProps) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [componentType, setComponentType] = useState<ComponentType>(
    template?.componentType ?? "SERVICE",
  );
  const [icon, setIcon] = useState(template?.icon ?? "");
  const [color, setColor] = useState(template?.color ?? "#6366f1");
  const [tags, setTags] = useState(template?.tags?.join(", ") ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    onSubmit({
      name,
      description: description || undefined,
      componentType,
      icon: icon || undefined,
      color: color || undefined,
      tags: tagList,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tmpl-name">Name</Label>
          <Input
            id="tmpl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Web API Server"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tmpl-type">Component Type</Label>
          <Select
            value={componentType}
            onValueChange={(v) => setComponentType(v as ComponentType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPONENT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tmpl-description">Description</Label>
        <Textarea
          id="tmpl-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A RESTful API server handling..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tmpl-icon">Icon (emoji or character)</Label>
          <Input
            id="tmpl-icon"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🔒"
            maxLength={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tmpl-color">Color</Label>
          <div className="flex gap-2">
            <Input
              id="tmpl-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-12 h-9 p-1"
            />
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#6366f1"
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tmpl-tags">Tags (comma-separated)</Label>
        <Input
          id="tmpl-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="api, web, server"
        />
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name || isLoading}>
          {template ? "Update" : "Create"} Template
        </Button>
      </div>
    </form>
  );
}
