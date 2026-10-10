"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import type { PromptOutputFormat } from "../../types";

const OUTPUT_FORMATS: { value: PromptOutputFormat; label: string }[] = [
  { value: "JSON", label: "JSON" },
  { value: "TEXT", label: "Plain Text" },
  { value: "MARKDOWN", label: "Markdown" },
];

interface PromptOutputTabProps {
  outputFormat: PromptOutputFormat;
  outputSchema: string;
  temperature: number;
  maxTokens: number;
  isReadOnly: boolean;
  onOutputFormatChange: (v: PromptOutputFormat) => void;
  onOutputSchemaChange: (v: string) => void;
  onTemperatureChange: (v: number) => void;
  onMaxTokensChange: (v: number) => void;
}

export function PromptOutputTab({
  outputFormat,
  outputSchema,
  temperature,
  maxTokens,
  isReadOnly,
  onOutputFormatChange,
  onOutputSchemaChange,
  onTemperatureChange,
  onMaxTokensChange,
}: PromptOutputTabProps) {
  return (
    <TabsContent value="output" className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Output Format</Label>
          <Select
            value={outputFormat}
            onValueChange={(v) => onOutputFormatChange(v as PromptOutputFormat)}
            disabled={isReadOnly}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTPUT_FORMATS.map((format) => (
                <SelectItem key={format.value} value={format.value}>
                  {format.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Max Tokens</Label>
          <Input
            type="number"
            value={maxTokens}
            onChange={(e) =>
              onMaxTokensChange(parseInt(e.target.value) || 2000)
            }
            min={100}
            max={8000}
            disabled={isReadOnly}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Temperature: {temperature.toFixed(2)}</Label>
        <Slider
          value={[temperature]}
          onValueChange={(v) => onTemperatureChange(v[0])}
          min={0}
          max={1}
          step={0.05}
          disabled={isReadOnly}
        />
        <p className="text-xs text-muted-foreground">
          Lower = more focused, Higher = more creative
        </p>
      </div>

      {outputFormat === "JSON" && (
        <div className="space-y-2">
          <Label htmlFor="outputSchema">Output JSON Schema (optional)</Label>
          <Textarea
            id="outputSchema"
            value={outputSchema}
            onChange={(e) => onOutputSchemaChange(e.target.value)}
            placeholder='{"type": "object", "properties": {...}}'
            rows={6}
            className="font-mono text-sm"
            disabled={isReadOnly}
          />
        </div>
      )}
    </TabsContent>
  );
}
