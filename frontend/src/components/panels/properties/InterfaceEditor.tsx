"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import type {
  ComponentInterface,
  InterfaceDirection,
  InterfacePosition,
  Protocol,
  AuthMethod,
} from "@/types/canvas";
import {
  interfaceDirections,
  interfacePositions,
  protocols,
  authMethods,
} from "./constants";

interface InterfaceEditorProps {
  iface: ComponentInterface;
  onUpdate: (updates: Partial<ComponentInterface>) => void;
  onRemove: () => void;
}

export function InterfaceEditor({
  iface,
  onUpdate,
  onRemove,
}: InterfaceEditorProps) {
  return (
    <div className="border rounded-md p-2 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between">
        <Input
          value={iface.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-6 text-xs font-medium flex-1 mr-1"
          placeholder="Interface name"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <Select
          value={iface.direction}
          onValueChange={(v) =>
            onUpdate({ direction: v as InterfaceDirection })
          }
        >
          <SelectTrigger
            className="h-6 text-[10px]"
            aria-label="Interface direction"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {interfaceDirections.map((d) => (
              <SelectItem key={d.value} value={d.value} className="text-xs">
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={iface.position}
          onValueChange={(v) => onUpdate({ position: v as InterfacePosition })}
        >
          <SelectTrigger
            className="h-6 text-[10px]"
            aria-label="Interface position"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {interfacePositions.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <Input
          type="number"
          value={iface.port || ""}
          onChange={(e) =>
            onUpdate({
              port: e.target.value ? parseInt(e.target.value) : undefined,
            })
          }
          className="h-6 text-[10px]"
          placeholder="Port"
          aria-label="Port number"
        />
        <Select
          value={iface.protocol}
          onValueChange={(v) => onUpdate({ protocol: v as Protocol })}
        >
          <SelectTrigger className="h-6 text-[10px]" aria-label="Protocol">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {protocols.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-1 items-center">
        <Select
          value={iface.authentication}
          onValueChange={(v) => onUpdate({ authentication: v as AuthMethod })}
        >
          <SelectTrigger
            className="h-6 text-[10px]"
            aria-label="Authentication method"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {authMethods.map((a) => (
              <SelectItem key={a.value} value={a.value} className="text-xs">
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Switch
            id={`encrypted-${iface.id}`}
            checked={iface.encrypted}
            onCheckedChange={(checked) => onUpdate({ encrypted: checked })}
            className="scale-75"
          />
          <Label htmlFor={`encrypted-${iface.id}`} className="text-[10px]">
            TLS
          </Label>
        </div>
      </div>
    </div>
  );
}
