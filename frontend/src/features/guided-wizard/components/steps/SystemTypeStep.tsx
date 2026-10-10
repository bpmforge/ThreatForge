"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { SYSTEM_TEMPLATES } from "../../data/system-types";
import type { SystemType, WizardAnswers } from "../../types";

interface SystemTypeStepProps {
  answers: WizardAnswers;
  onUpdate: (updates: Partial<WizardAnswers>) => void;
}

export function SystemTypeStep({ answers, onUpdate }: SystemTypeStepProps) {
  const systemTypes = Object.entries(SYSTEM_TEMPLATES) as [
    SystemType,
    (typeof SYSTEM_TEMPLATES)[SystemType],
  ][];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">
          What type of system are you modeling?
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {systemTypes.map(([type, template]) => (
            <Card
              key={type}
              className={`p-4 cursor-pointer transition-colors ${
                answers.systemType === type
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
              onClick={() => onUpdate({ systemType: type })}
            >
              <div className="font-medium">{template.name}</div>
              <div className="text-sm text-muted-foreground">
                {template.description}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="system-name">System Name</Label>
          <Input
            id="system-name"
            value={answers.systemName || ""}
            onChange={(e) => onUpdate({ systemName: e.target.value })}
            placeholder="e.g., Payment Processing API"
          />
        </div>
        <div>
          <Label htmlFor="system-desc">Description (optional)</Label>
          <Input
            id="system-desc"
            value={answers.systemDescription || ""}
            onChange={(e) => onUpdate({ systemDescription: e.target.value })}
            placeholder="Brief description of your system"
          />
        </div>
      </div>
    </div>
  );
}
