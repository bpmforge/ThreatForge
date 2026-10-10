"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRightLeft } from "lucide-react";
import type { DFDEdge } from "@/types/dfd-canvas";
import type { DataType, FlowVolume } from "../types";
import { DATA_TYPE_OPTIONS, VOLUME_OPTIONS } from "./dfd-panel-options";

interface DFDCanvasFlowPanelProps {
  edge: DFDEdge;
  onUpdate: (data: Partial<DFDEdge["data"]>) => void;
}

export function DFDCanvasFlowPanel({
  edge,
  onUpdate,
}: DFDCanvasFlowPanelProps) {
  const [name, setName] = useState(edge.data?.name || "");
  const [number, setNumber] = useState(edge.data?.number || "");
  const [volume, setVolume] = useState<FlowVolume | "">(
    edge.data?.volume || "",
  );
  const [dataTypes, setDataTypes] = useState<DataType[]>(
    edge.data?.dataTypes || [],
  );

  const handleBlur = () =>
    onUpdate({
      name,
      number: number || undefined,
      volume: volume || undefined,
      dataTypes,
    });

  const toggleDataType = (type: DataType) => {
    const newTypes = dataTypes.includes(type)
      ? dataTypes.filter((t) => t !== type)
      : [...dataTypes, type];
    setDataTypes(newTypes);
    onUpdate({
      name,
      number: number || undefined,
      volume: volume || undefined,
      dataTypes: newTypes,
    });
  };

  const handleVolumeChange = (v: FlowVolume) => {
    setVolume(v);
    onUpdate({ name, number: number || undefined, volume: v, dataTypes });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <ArrowRightLeft className="h-5 w-5 text-slate-500" />
        <h3 className="font-semibold">Data Flow</h3>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="flow-number" className="text-xs">
            Number
          </Label>
          <Input
            id="flow-number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onBlur={handleBlur}
            placeholder="F1"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="flow-name" className="text-xs">
            Name
          </Label>
          <Input
            id="flow-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            placeholder="Data Flow Name"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Volume</Label>
          <Select value={volume} onValueChange={handleVolumeChange}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {VOLUME_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator />
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
