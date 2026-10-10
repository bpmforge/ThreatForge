"use client";

/**
 * CsvImportDialog — Two-step CSV import with preview.
 * Step 1: paste/upload CSV, see per-row status (new/duplicate/error).
 * Step 2: commit on confirm.
 */
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { requirementsApi } from "../services/requirements-api";
import { useQueryClient } from "@tanstack/react-query";
import type { CsvImportPreviewRow } from "../types";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: "text-emerald-700 bg-emerald-50",
  duplicate: "text-amber-700 bg-amber-50",
  error: "text-red-700 bg-red-50",
};

export function CsvImportDialog({
  open,
  onOpenChange,
  modelId,
}: CsvImportDialogProps) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<CsvImportPreviewRow[] | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const reset = () => {
    setCsvText("");
    setPreview(null);
    setNewCount(0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    try {
      const result = await requirementsApi.importCsvPreview(modelId, csvText);
      setPreview(result.preview);
      setNewCount(result.newCount);
    } catch (err) {
      toast.error((err as Error).message ?? "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    try {
      const result = await requirementsApi.importCsv(modelId, csvText);
      qc.invalidateQueries({ queryKey: ["requirements", modelId] });
      toast.success(
        `Imported ${result.created} requirement${result.created !== 1 ? "s" : ""}`,
      );
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message ?? "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Requirements from CSV</DialogTitle>
          <DialogDescription>
            Expected columns: <code>reqId, text, category</code> (category
            optional). First row may be a header.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">CSV content</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => fileRef.current?.click()}
              >
                Upload file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <Textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setPreview(null);
              }}
              placeholder={
                "reqId,text,category\nFR-1,System shall use TLS,security"
              }
              rows={5}
              className="text-xs font-mono"
            />
          </div>

          {preview && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-1">
              <p className="text-xs text-muted-foreground">
                Preview:{" "}
                <span className="text-emerald-700">{newCount} new</span>,{" "}
                {preview.filter((r) => r.status === "duplicate").length}{" "}
                duplicate, {preview.filter((r) => r.status === "error").length}{" "}
                error
              </p>
              <ScrollArea className="flex-1 border rounded text-xs">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">
                        Status
                      </th>
                      <th className="px-2 py-1 text-left font-medium">
                        Req ID
                      </th>
                      <th className="px-2 py-1 text-left font-medium">Text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_COLORS[row.status]}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-2 py-1 font-mono">{row.reqId}</td>
                        <td
                          className="px-2 py-1 truncate max-w-[160px]"
                          title={row.text}
                        >
                          {row.error ?? row.text}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!preview ? (
            <Button
              onClick={handlePreview}
              disabled={!csvText.trim() || loading}
            >
              Preview
            </Button>
          ) : (
            <Button onClick={handleCommit} disabled={newCount === 0 || loading}>
              Import {newCount > 0 ? `${newCount} rows` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
