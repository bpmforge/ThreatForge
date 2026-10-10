"use client";

/**
 * FrameworkImportDialog — Import controls from a built-in compliance framework
 * or a custom framework as requirements.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { requirementsApi } from "../services/requirements-api";
import { useQueryClient } from "@tanstack/react-query";

const BUILT_IN_FRAMEWORKS: Array<{ id: string; label: string }> = [
  { id: "HIPAA", label: "HIPAA Security Rule" },
  { id: "PCI_DSS", label: "PCI DSS 4.0" },
  { id: "NIST_800_53", label: "NIST SP 800-53" },
  { id: "NIST_CSF", label: "NIST CSF 2.0" },
  { id: "NIST_800_171", label: "NIST SP 800-171" },
  { id: "SOC2", label: "SOC 2 Type II" },
  { id: "ISO27001", label: "ISO 27001:2022" },
  { id: "ISO_27701", label: "ISO 27701:2019" },
  { id: "OWASP_ASVS", label: "OWASP ASVS 4.0" },
  { id: "CMMC", label: "CMMC 2.0" },
  { id: "FDA_CYBER", label: "FDA Cybersecurity (Medical Devices)" },
  { id: "CCPA", label: "CCPA/CPRA" },
];

interface FrameworkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
}

export function FrameworkImportDialog({
  open,
  onOpenChange,
  modelId,
}: FrameworkImportDialogProps) {
  const [frameworkId, setFrameworkId] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const reset = () => setFrameworkId("");

  const handleImport = async () => {
    if (!frameworkId) return;
    setLoading(true);
    try {
      const result = await requirementsApi.importFramework(
        modelId,
        frameworkId,
        ["*"],
      );
      qc.invalidateQueries({ queryKey: ["requirements", modelId] });
      toast.success(
        `Imported ${result.created} control${result.created !== 1 ? "s" : ""} from ${result.framework}` +
          (result.skipped > 0 ? ` (${result.skipped} already existed)` : ""),
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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Import from Compliance Framework</DialogTitle>
          <DialogDescription>
            All controls from the selected framework will be imported as
            requirements. Duplicates are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="fw-select" className="text-xs">
              Framework
            </Label>
            <Select value={frameworkId} onValueChange={setFrameworkId}>
              <SelectTrigger id="fw-select">
                <SelectValue placeholder="Select a framework…" />
              </SelectTrigger>
              <SelectContent>
                {BUILT_IN_FRAMEWORKS.map((fw) => (
                  <SelectItem key={fw.id} value={fw.id}>
                    {fw.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Custom frameworks can also be imported by entering their short name
            directly via the API.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!frameworkId || loading}>
            {loading ? "Importing…" : "Import All Controls"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
