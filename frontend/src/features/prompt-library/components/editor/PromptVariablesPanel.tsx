"use client";

/**
 * PromptVariablesPanel — Variables tab content for the prompt editor.
 *
 * Lists all variables detected from the prompt template and allows
 * configuring their display name, type, and required flag.
 * Extracted from PromptEditor to keep the layout orchestrator ≤200 lines.
 */

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import type { PromptVariable } from "../../types";

interface PromptVariablesPanelProps {
  variables: PromptVariable[];
  isReadOnly: boolean;
  onUpdateVariable: (index: number, updates: Partial<PromptVariable>) => void;
}

export function PromptVariablesPanel({
  variables,
  isReadOnly,
  onUpdateVariable,
}: PromptVariablesPanelProps) {
  return (
    <TabsContent value="variables" className="space-y-4">
      {variables.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No variables detected. Add {"{{variableName}}"} to your user prompt
            template.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {variables.map((variable, index) => (
            <Card key={variable.name}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-mono">{`{{${variable.name}}}`}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={variable.displayName || ""}
                    onChange={(e) =>
                      onUpdateVariable(index, { displayName: e.target.value })
                    }
                    placeholder={variable.name}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={variable.type}
                    onValueChange={(v) =>
                      onUpdateVariable(index, {
                        type: v as "text" | "json" | "number" | "boolean",
                      })
                    }
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`required-${index}`}
                      checked={variable.required ?? true}
                      onCheckedChange={(checked) =>
                        onUpdateVariable(index, { required: checked })
                      }
                      disabled={isReadOnly}
                    />
                    <Label htmlFor={`required-${index}`}>Required</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </TabsContent>
  );
}
