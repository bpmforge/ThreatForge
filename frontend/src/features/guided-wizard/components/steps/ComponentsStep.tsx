"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import type { SuggestedComponent } from "../../types";

interface ComponentsStepProps {
  components: SuggestedComponent[];
  onToggle: (id: string) => void;
}

export function ComponentsStep({ components, onToggle }: ComponentsStepProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Review suggested components</h3>
      <p className="text-sm text-muted-foreground">
        Based on your system type, we suggest these components. Uncheck any you
        don&apos;t need.
      </p>
      <div className="space-y-2">
        {components.map((component) => (
          <Card key={component.id} className="p-3 flex items-center gap-3">
            <Checkbox
              checked={component.selected}
              onCheckedChange={() => onToggle(component.id)}
            />
            <div>
              <div className="font-medium">{component.name}</div>
              <div className="text-xs text-muted-foreground">
                {component.type}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
