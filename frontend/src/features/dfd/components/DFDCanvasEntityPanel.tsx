"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";
import type { DFDNode } from "@/types/dfd-canvas";
import type { ExternalEntityType } from "../types";
import { ENTITY_TYPE_OPTIONS } from "./dfd-panel-options";

interface DFDCanvasEntityPanelProps {
  node: DFDNode;
  onUpdate: (data: Partial<DFDNode["data"]>) => void;
}

export function DFDCanvasEntityPanel({
  node,
  onUpdate,
}: DFDCanvasEntityPanelProps) {
  const [name, setName] = useState(node.data.name || "");
  const [entityType, setEntityType] = useState<ExternalEntityType>(
    (node.data as { entityType?: ExternalEntityType }).entityType || "USER",
  );

  const handleBlur = () => onUpdate({ name, entityType });

  const handleTypeChange = (type: ExternalEntityType) => {
    setEntityType(type);
    onUpdate({ name, entityType: type });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Users className="h-5 w-5 text-amber-500" />
        <h3 className="font-semibold">External Entity</h3>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="entity-name" className="text-xs">
            Name
          </Label>
          <Input
            id="entity-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            placeholder="Entity Name"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={entityType} onValueChange={handleTypeChange}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
