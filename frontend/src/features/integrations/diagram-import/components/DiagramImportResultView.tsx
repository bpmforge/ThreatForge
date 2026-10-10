"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle, AlertCircle, Layers, Workflow } from "lucide-react";

type ImportTarget = "architecture" | "dfd";

interface ImportResult {
  nodes: unknown[];
  edges: unknown[];
  warnings: string[];
}

interface DiagramImportResultViewProps {
  result: ImportResult;
  importTarget: ImportTarget;
  onImportTargetChange: (target: ImportTarget) => void;
  showDFDOption: boolean;
  onClearResult: () => void;
  onConfirm: () => void;
}

export function DiagramImportResultView({
  result,
  importTarget,
  onImportTargetChange,
  showDFDOption,
  onClearResult,
  onConfirm,
}: DiagramImportResultViewProps) {
  return (
    <div className="space-y-4">
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Successfully parsed diagram! Found {result.nodes.length} components
          and {result.edges.length} connections.
        </AlertDescription>
      </Alert>

      {result.warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 text-sm">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <Label>Import into:</Label>
        <RadioGroup
          value={importTarget}
          onValueChange={(v) => onImportTargetChange(v as ImportTarget)}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="architecture" id="target-arch" />
            <Label
              htmlFor="target-arch"
              className="flex items-center gap-2 cursor-pointer"
            >
              <Layers className="h-4 w-4" />
              Architecture Canvas
            </Label>
          </div>
          {showDFDOption && (
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dfd" id="target-dfd" />
              <Label
                htmlFor="target-dfd"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Workflow className="h-4 w-4" />
                Data Flow Diagram
              </Label>
            </div>
          )}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          {importTarget === "architecture"
            ? "Import as threat model components with security properties"
            : "Import as DFD elements (Processes, Data Stores, External Entities)"}
        </p>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClearResult}>
          Import Different File
        </Button>
        <Button onClick={onConfirm}>
          Add to {importTarget === "dfd" ? "DFD" : "Canvas"}
        </Button>
      </div>
    </div>
  );
}
