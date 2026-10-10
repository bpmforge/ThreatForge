"use client";

import { Button } from "@/components/ui/button";
import { Network, Plus } from "lucide-react";
import type { ComponentNodeData, ComponentInterface } from "@/types/canvas";
import { INTERFACE_PRESETS } from "@/constants/interface-presets";
import { Section } from "./Section";
import { InterfaceEditor } from "./InterfaceEditor";

interface InterfacesSectionProps {
  data: ComponentNodeData;
  onAddInterface: () => void;
  onApplyPreset: () => void;
  onRemoveInterface: (id: string) => void;
  onUpdateInterface: (id: string, updates: Partial<ComponentInterface>) => void;
}

export function InterfacesSection({
  data,
  onAddInterface,
  onApplyPreset,
  onRemoveInterface,
  onUpdateInterface,
}: InterfacesSectionProps) {
  return (
    <Section
      title="Interfaces"
      icon={Network}
      defaultOpen={true}
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddInterface}
          className="h-6 w-6 p-0"
          title="Add Interface"
        >
          <Plus className="h-3 w-3" />
        </Button>
      }
    >
      {INTERFACE_PRESETS[data.type] && (
        <Button
          variant="outline"
          size="sm"
          onClick={onApplyPreset}
          className="w-full h-7 text-xs"
        >
          Apply {data.type} Preset
        </Button>
      )}

      {(data.interfaces || []).length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          No interfaces defined. Using default handles.
        </p>
      ) : (
        <div className="space-y-3">
          {(data.interfaces || []).map((iface) => (
            <InterfaceEditor
              key={iface.id}
              iface={iface}
              onUpdate={(updates) => onUpdateInterface(iface.id, updates)}
              onRemove={() => onRemoveInterface(iface.id)}
            />
          ))}
        </div>
      )}
    </Section>
  );
}
