"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileJson, FileSpreadsheet, Download } from "lucide-react";
import type { CatalogThreat } from "../types";
import {
  useCustomSourceImport,
  SAMPLE_JSON,
  SAMPLE_CSV,
} from "../hooks/useCustomSourceImport";
import { ParseResultsPanel } from "./ParseResultsPanel";

interface CustomSourceImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (threats: CatalogThreat[], sourceName: string) => void;
}

export function CustomSourceImport({
  open,
  onOpenChange,
  onImport,
}: CustomSourceImportProps) {
  const f = useCustomSourceImport(onImport, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Custom Threat Source
          </DialogTitle>
          <DialogDescription>
            Import threats from JSON or CSV format to add to your catalog.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div>
            <Label htmlFor="sourceName">Source Name</Label>
            <Input
              id="sourceName"
              placeholder="e.g., Internal Security Standards"
              value={f.sourceName}
              onChange={(e) => f.setSourceName(e.target.value)}
              className="mt-1"
            />
          </div>

          <Tabs
            value={f.activeTab}
            onValueChange={(v) => f.setActiveTab(v as "json" | "csv" | "file")}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="json" className="flex items-center gap-1">
                <FileJson className="h-4 w-4" /> JSON
              </TabsTrigger>
              <TabsTrigger value="csv" className="flex items-center gap-1">
                <FileSpreadsheet className="h-4 w-4" /> CSV
              </TabsTrigger>
              <TabsTrigger value="file" className="flex items-center gap-1">
                <Upload className="h-4 w-4" /> File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="json" className="space-y-2">
              <Textarea
                placeholder={SAMPLE_JSON}
                value={f.jsonInput}
                onChange={(e) => {
                  f.setJsonInput(e.target.value);
                  f.setParseResult(null);
                }}
                className="font-mono text-xs h-40"
              />
              <Button
                variant="link"
                size="sm"
                onClick={() => f.setJsonInput(SAMPLE_JSON)}
              >
                <Download className="h-3 w-3 mr-1" /> Load Sample
              </Button>
            </TabsContent>

            <TabsContent value="csv" className="space-y-2">
              <Textarea
                placeholder={SAMPLE_CSV}
                value={f.csvInput}
                onChange={(e) => {
                  f.setCsvInput(e.target.value);
                  f.setParseResult(null);
                }}
                className="font-mono text-xs h-40"
              />
              <Button
                variant="link"
                size="sm"
                onClick={() => f.setCsvInput(SAMPLE_CSV)}
              >
                <Download className="h-3 w-3 mr-1" /> Load Sample
              </Button>
            </TabsContent>

            <TabsContent value="file">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={f.handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JSON or CSV files
                  </p>
                </label>
              </div>
            </TabsContent>
          </Tabs>

          <Button onClick={f.handleParse} variant="secondary">
            Parse Data
          </Button>

          {f.parseResult && <ParseResultsPanel result={f.parseResult} />}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={f.handleImport}
            disabled={
              !f.parseResult ||
              f.parseResult.threats.length === 0 ||
              !f.sourceName.trim()
            }
          >
            Import {f.parseResult?.threats.length || 0} Threats
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
