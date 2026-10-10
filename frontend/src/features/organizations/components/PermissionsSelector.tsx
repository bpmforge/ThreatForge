"use client";

import { ChevronDown, ChevronUp, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Permission } from "../hooks/useCustomRoles";

interface PermissionsSelectorProps {
  permissionsByCategory: Record<string, Permission[]>;
  selected: Set<string>;
  expanded: Set<string>;
  onToggle: (permId: string) => void;
  onToggleCategory: (category: string) => void;
}

export function PermissionsSelector({
  permissionsByCategory,
  selected,
  expanded,
  onToggle,
  onToggleCategory,
}: PermissionsSelectorProps) {
  return (
    <div className="border rounded-lg divide-y">
      {Object.entries(permissionsByCategory).map(([category, perms]) => (
        <Collapsible
          key={category}
          open={expanded.has(category)}
          onOpenChange={() => onToggleCategory(category)}
        >
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full p-3 hover:bg-muted/50 text-left">
              <span className="font-medium">{category}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {perms.filter((p) => selected.has(p.id)).length}/
                  {perms.length}
                </span>
                {expanded.has(category) ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-3 pt-0 space-y-2">
              {perms.map((perm) => (
                <label
                  key={perm.id}
                  className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(perm.id)}
                    onCheckedChange={() => onToggle(perm.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{perm.label}</span>
                      {selected.has(perm.id) && (
                        <Check className="size-3 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {perm.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
