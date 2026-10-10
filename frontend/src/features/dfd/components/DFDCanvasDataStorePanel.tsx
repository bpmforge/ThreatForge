"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Database } from "lucide-react";
import type { DFDNode } from "@/types/dfd-canvas";
import type { DataType } from "../types";
import { DATA_TYPE_OPTIONS } from "./dfd-panel-options";

interface DFDCanvasDataStorePanelProps {
  node: DFDNode;
  onUpdate: (data: Partial<DFDNode["data"]>) => void;
}

export function DFDCanvasDataStorePanel({
  node,
  onUpdate,
}: DFDCanvasDataStorePanelProps) {
  const [name, setName] = useState(node.data.name || "");
  const [number, setNumber] = useState(
    (node.data as { number?: string }).number || "",
  );
  const [dataTypes, setDataTypes] = useState<DataType[]>(
    (node.data as { dataTypes?: DataType[] }).dataTypes || [],
  );

  const handleBlur = () => onUpdate({ name, number, dataTypes });

  const toggleDataType = (type: DataType) => {
    const newTypes = dataTypes.includes(type)
      ? dataTypes.filter((t) => t !== type)
      : [...dataTypes, type];
    setDataTypes(newTypes);
    onUpdate({ name, number, dataTypes: newTypes });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Database className="h-5 w-5 text-purple-500" />
        <h3 className="font-semibold">Data Store</h3>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="store-number" className="text-xs">
            Number
          </Label>
          <Input
            id="store-number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onBlur={handleBlur}
            placeholder="D1"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="store-name" className="text-xs">
            Name
          </Label>
          <Input
            id="store-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            placeholder="Data Store Name"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Data Types</Label>
          <div className="flex flex-wrap gap-1">
            {DATA_TYPE_OPTIONS.map((opt) => (
              <Badge
                key={opt.value}
                variant={dataTypes.includes(opt.value) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggleDataType(opt.value)}
              >
                {opt.label}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
