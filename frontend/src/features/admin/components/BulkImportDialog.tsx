/**
 * Dialog for bulk importing users via CSV
 */
"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Download, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useBulkInvite } from "../hooks/useAdmin";
import type { BulkInviteResponse } from "../services/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SAMPLE_CSV = `email,role,organizationId
user1@example.com,EDITOR,org_abc123
user2@example.com,VIEWER,org_abc123
user3@example.com,ADMIN,org_xyz789`;

export function BulkImportDialog({ open, onOpenChange }: Props) {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<BulkInviteResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkInvite = useBulkInvite();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsv(event.target?.result as string);
    };
    reader.readAsText(file);
  }

  function handleDownloadTemplate() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSubmit() {
    if (!csv.trim()) return;

    setResult(null);
    bulkInvite.mutate(csv, { onSuccess: setResult });
  }

  function handleClose() {
    setCsv("");
    setResult(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Users</DialogTitle>
          <DialogDescription>
            Import multiple users at once using a CSV file. Each row should
            contain email, role (ADMIN/EDITOR/VIEWER), and organization ID.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload and template download */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={bulkInvite.isPending}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* CSV textarea */}
          <div className="space-y-2">
            <Label htmlFor="csv">CSV Content</Label>
            <Textarea
              id="csv"
              placeholder="email,role,organizationId&#10;user@example.com,EDITOR,org_abc123"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              disabled={bulkInvite.isPending}
              className="font-mono text-sm min-h-[200px]"
            />
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-2">
              <Alert variant={result.success ? "default" : "destructive"}>
                <AlertDescription>
                  Processed {result.totalProcessed} entries:{" "}
                  {result.successCount} successful, {result.failureCount} failed
                </AlertDescription>
              </Alert>

              {result.results.length > 0 && (
                <div className="max-h-[200px] overflow-y-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">Line</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{r.line}</td>
                          <td className="p-2 font-mono text-xs">{r.email}</td>
                          <td className="p-2">
                            {r.success ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                Invited
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-600">
                                <XCircle className="h-4 w-4" />
                                {r.error}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              onClick={handleSubmit}
              disabled={!csv.trim() || bulkInvite.isPending}
            >
              {bulkInvite.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Import Users
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
