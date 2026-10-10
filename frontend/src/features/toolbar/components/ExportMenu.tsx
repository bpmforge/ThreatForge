"use client";

/**
 * ExportMenu - Dropdown menu for export options with PDF options dialog.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileJson,
  FileType,
  Image,
  FileCode,
  FileText,
  Download,
} from "lucide-react";

interface ExportMenuProps {
  exporting: boolean;
  onExportJSON: () => void;
  onExportYAML: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportPDF: (sections?: string[]) => void;
  onExportMermaid?: () => void;
  onExportDrawio?: () => void;
  onExportRiskRegister?: () => void;
  onExportThreatModelCode?: () => void;
  onExportDocx?: () => void;
}

const PDF_SECTIONS = [
  { key: "diagram", label: "Architecture Diagram", default: true },
  { key: "threats", label: "Threat Table", default: true },
  { key: "mitigations", label: "Mitigations & Controls", default: true },
  { key: "stride", label: "STRIDE Summary Chart", default: true },
  { key: "compliance", label: "Compliance Mapping", default: false },
  { key: "requirements", label: "Requirements Coverage", default: false },
  { key: "riskMatrix", label: "Risk Matrix", default: true },
];

export function ExportMenu({
  exporting,
  onExportJSON,
  onExportYAML,
  onExportPNG,
  onExportSVG,
  onExportPDF,
  onExportMermaid,
  onExportDrawio,
  onExportRiskRegister,
  onExportThreatModelCode,
  onExportDocx,
}: ExportMenuProps) {
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [pdfSections, setPdfSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PDF_SECTIONS.map((s) => [s.key, s.default])),
  );

  const handlePdfExport = () => {
    const selected = Object.entries(pdfSections)
      .filter(([, v]) => v)
      .map(([k]) => k);
    onExportPDF(selected);
    setShowPdfOptions(false);
  };

  const toggleSection = (key: string) => {
    setPdfSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Data Formats
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={onExportJSON}>
            <FileJson className="h-4 w-4 mr-2" />
            JSON (Full Export)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportYAML}>
            <FileType className="h-4 w-4 mr-2" />
            YAML (Git-Diffable)
          </DropdownMenuItem>
          {onExportThreatModelCode && (
            <DropdownMenuItem onClick={onExportThreatModelCode}>
              <FileCode className="h-4 w-4 mr-2" />
              Export as Code (threatforge.yaml)
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Images
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={onExportPNG}>
            <Image className="h-4 w-4 mr-2" />
            PNG Image
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportSVG}>
            <Image className="h-4 w-4 mr-2" />
            SVG Vector
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Diagrams
          </DropdownMenuLabel>
          {onExportMermaid && (
            <DropdownMenuItem onClick={onExportMermaid}>
              <FileCode className="h-4 w-4 mr-2" />
              Mermaid (.mmd)
            </DropdownMenuItem>
          )}
          {onExportDrawio && (
            <DropdownMenuItem onClick={onExportDrawio}>
              <FileCode className="h-4 w-4 mr-2" />
              Draw.io (.drawio)
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Reports
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setShowPdfOptions(true)}>
            <FileText className="h-4 w-4 mr-2" />
            PDF Report...
          </DropdownMenuItem>
          {onExportDocx && (
            <DropdownMenuItem onClick={onExportDocx}>
              <FileText className="h-4 w-4 mr-2" />
              Word Report (.doc)
            </DropdownMenuItem>
          )}
          {onExportRiskRegister && (
            <DropdownMenuItem onClick={onExportRiskRegister}>
              <FileText className="h-4 w-4 mr-2" />
              Risk Register (CSV)
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showPdfOptions} onOpenChange={setShowPdfOptions}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>PDF Report Options</DialogTitle>
            <DialogDescription>
              Choose which sections to include in the exported report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {PDF_SECTIONS.map((section) => (
              <div key={section.key} className="flex items-center gap-2">
                <Checkbox
                  id={`pdf-${section.key}`}
                  checked={pdfSections[section.key]}
                  onCheckedChange={() => toggleSection(section.key)}
                />
                <Label
                  htmlFor={`pdf-${section.key}`}
                  className="text-sm cursor-pointer"
                >
                  {section.label}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPdfOptions(false)}>
              Cancel
            </Button>
            <Button onClick={handlePdfExport} disabled={exporting}>
              {exporting ? "Exporting..." : "Generate PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
