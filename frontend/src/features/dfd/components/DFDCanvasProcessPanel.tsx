"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Workflow } from "lucide-react";
import type { DFDNode } from "@/types/dfd-canvas";

interface DFDCanvasProcessPanelProps {
  node: DFDNode;
  onUpdate: (data: Partial<DFDNode["data"]>) => void;
}

export function DFDCanvasProcessPanel({
  node,
  onUpdate,
}: DFDCanvasProcessPanelProps) {
  const [name, setName] = useState(node.data.name || "");
  const [number, setNumber] = useState(
    (node.data as { number?: string }).number || "",
  );
  const [description, setDescription] = useState(
    (node.data as { description?: string }).description || "",
  );

  const handleBlur = () => onUpdate({ name, number, description });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Workflow className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold">Process</h3>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="process-number" className="text-xs">
            Number
          </Label>
          <Input
            id="process-number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onBlur={handleBlur}
            placeholder="1.0"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="process-name" className="text-xs">
            Name
          </Label>
          <Input
            id="process-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            placeholder="Process Name"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="process-desc" className="text-xs">
            Description
          </Label>
          <Textarea
            id="process-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleBlur}
            placeholder="What does this process do?"
            rows={3}
            className="text-sm"
          />
        </div>
      </div>
    </div>
  );
}
