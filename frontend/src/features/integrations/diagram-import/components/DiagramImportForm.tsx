"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileUp } from "lucide-react";
import type { DiagramSource } from "../types";
import { IMPORT_OPTIONS } from "../constants/import-options";

interface DiagramImportFormProps {
  importMode: "file" | "paste";
  onImportModeChange: (mode: "file" | "paste") => void;
  selectedSource: DiagramSource | null;
  onSourceSelect: (source: DiagramSource) => void;
  pasteContent: string;
  onPasteContentChange: (v: string) => void;
  loading: boolean;
  onFileSelect: (file: File) => void;
  onPasteImport: () => void;
}

export function DiagramImportForm({
  importMode,
  onImportModeChange,
  selectedSource,
  onSourceSelect,
  pasteContent,
  onPasteContentChange,
  loading,
  onFileSelect,
  onPasteImport,
}: DiagramImportFormProps) {
  return (
    <Tabs
      value={importMode}
      onValueChange={(v) => onImportModeChange(v as "file" | "paste")}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="file">Upload File</TabsTrigger>
        <TabsTrigger value="paste">Paste Content</TabsTrigger>
      </TabsList>

      <TabsContent value="file" className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {IMPORT_OPTIONS.map((option) => (
            <Card
              key={option.source}
              className={`cursor-pointer transition-colors ${
                selectedSource === option.source
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
              onClick={() => onSourceSelect(option.source)}
            >
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center gap-2">
                  <option.icon className="h-4 w-4" />
                  <CardTitle className="text-sm">{option.label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedSource && (
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <Input
              type="file"
              accept={
                IMPORT_OPTIONS.find((o) => o.source === selectedSource)?.accept
              }
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelect(file);
              }}
              className="hidden"
              id="diagram-file-input"
              disabled={loading}
            />
            <label
              htmlFor="diagram-file-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <FileUp className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Click to select file</span>
              <span className="text-xs text-muted-foreground">
                Accepts:{" "}
                {
                  IMPORT_OPTIONS.find((o) => o.source === selectedSource)
                    ?.accept
                }
              </span>
            </label>
          </div>
        )}
      </TabsContent>

      <TabsContent value="paste" className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="paste-content">
            Paste Mermaid, Draw.io XML, or Lucidchart CSV
          </Label>
          <Textarea
            id="paste-content"
            placeholder={`flowchart TB\n    A[Web App] --> B[API Gateway]\n    B --> C[(Database)]\n    B --> D[Cache]`}
            value={pasteContent}
            onChange={(e) => onPasteContentChange(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Format will be auto-detected from content
          </p>
        </div>

        <Button
          onClick={onPasteImport}
          disabled={loading || !pasteContent.trim()}
          className="w-full"
        >
          {loading ? "Processing..." : "Import Content"}
        </Button>
      </TabsContent>
    </Tabs>
  );
}
