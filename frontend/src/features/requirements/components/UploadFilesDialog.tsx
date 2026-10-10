"use client";

/**
 * UploadFilesDialog — Upload or paste source files to run the code scanner
 * against a specific threat's mitigations.
 */
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useThreats } from "@/features/threats/hooks/useThreats";
import { gapAnalysisApi } from "../services/gap-analysis-api";
import { Upload, X } from "lucide-react";

interface UploadFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
}

interface SourceFile {
  name: string;
  content: string;
}

export function UploadFilesDialog({
  open,
  onOpenChange,
  modelId,
}: UploadFilesDialogProps) {
  const [threatId, setThreatId] = useState("");
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: threats = [] } = useThreats(modelId);
  const nonScanThreats = threats.filter((t) => t.category !== "CODE_SCAN");

  const reset = () => {
    setThreatId("");
    setFiles([]);
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setFiles((prev) => {
          if (prev.some((f) => f.name === file.name)) return prev;
          return [...prev, { name: file.name, content }];
        });
      };
      reader.readAsText(file);
    });
  };

  const handleScan = async () => {
    if (!threatId || files.length === 0) return;
    setLoading(true);
    try {
      const result = await gapAnalysisApi.scanCode(modelId, {
        threatId,
        files: files.map((f) => ({ path: f.name, content: f.content })),
      });
      qc.invalidateQueries({ queryKey: ["gap-analysis", modelId] });
      qc.invalidateQueries({ queryKey: ["threats", modelId] });
      qc.invalidateQueries({ queryKey: ["documents", modelId] });
      if (result.created === 0) {
        toast.info("No new controls detected");
      } else {
        toast.success(
          `Detected ${result.created} control${result.created !== 1 ? "s" : ""}` +
            (result.skipped > 0 ? ` (${result.skipped} already existed)` : ""),
        );
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message ?? "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  const isValid = !!threatId && files.length > 0 && !loading;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Scan Local Files
          </DialogTitle>
          <DialogDescription>
            Upload source files to detect security controls and create COMPLETED
            mitigations on the selected threat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Attach findings to threat *</Label>
            <Select value={threatId} onValueChange={setThreatId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select a threat…" />
              </SelectTrigger>
              <SelectContent>
                {nonScanThreats.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-sm">
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Source files *</Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-16 border-2 border-dashed rounded-lg text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="h-3.5 w-3.5" />
              Click to select files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".ts,.tsx,.js,.jsx,.py,.go,.rb,.java,.cs,.php"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {files.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1"
                >
                  <span className="truncate">{f.name}</span>
                  <button
                    onClick={() =>
                      setFiles((prev) => prev.filter((x) => x.name !== f.name))
                    }
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleScan} disabled={!isValid}>
            {loading ? "Scanning…" : "Scan Files"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
