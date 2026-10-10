"use client";

import { useState } from "react";
import type { Framework } from "../types";
import { useCompliance } from "../hooks/useCompliance";
import { CoverageMatrix } from "./CoverageMatrix";
import { GapList } from "./GapList";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ShieldCheck, FileDown } from "lucide-react";
import { exportCompliancePDF } from "@/features/export/services/compliance-pdf-export";
import { useState as useExportState } from "react";

/** Framework options organized by category */
const FRAMEWORK_OPTIONS = {
  general: [
    { value: "SOC2", label: "SOC 2 Type II" },
    { value: "ISO27001", label: "ISO 27001" },
  ],
  us: [
    { value: "NIST_CSF", label: "NIST CSF" },
    { value: "NIST_800_53", label: "NIST 800-53" },
    { value: "FIPS_140", label: "FIPS 140-3" },
    { value: "FIPS_199", label: "FIPS 199" },
    { value: "FEDRAMP", label: "FedRAMP" },
    { value: "HIPAA", label: "HIPAA" },
    { value: "PCI_DSS", label: "PCI DSS" },
  ],
  other: [
    { value: "GDPR", label: "GDPR" },
    { value: "CIS_CONTROLS", label: "CIS Controls" },
    { value: "OWASP_ASVS", label: "OWASP ASVS" },
  ],
} as const;

interface CompliancePanelProps {
  modelId: string;
  modelName?: string;
  orgName?: string;
}

export function CompliancePanel({
  modelId,
  modelName = "Threat Model",
  orgName = "Organization",
}: CompliancePanelProps) {
  const [selectedFramework, setSelectedFramework] = useState<Framework>("SOC2");
  const [exporting, setExporting] = useExportState(false);
  const { data, isLoading } = useCompliance(modelId, selectedFramework);

  async function handleExportPDF() {
    setExporting(true);
    try {
      await exportCompliancePDF(modelId, modelName, orgName, selectedFramework);
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Compliance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Compliance Analysis
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={exporting || !data}
            aria-label="Export audit report as PDF"
          >
            <FileDown className="h-4 w-4 mr-2" />
            {exporting ? "Generating…" : "Export Audit Report"}
          </Button>
        </div>
        <Select
          value={selectedFramework}
          onValueChange={(v) => setSelectedFramework(v as Framework)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>General</SelectLabel>
              {FRAMEWORK_OPTIONS.general.map((fw) => (
                <SelectItem key={fw.value} value={fw.value}>
                  {fw.label}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>US Federal</SelectLabel>
              {FRAMEWORK_OPTIONS.us.map((fw) => (
                <SelectItem key={fw.value} value={fw.value}>
                  {fw.label}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Other Standards</SelectLabel>
              {FRAMEWORK_OPTIONS.other.map((fw) => (
                <SelectItem key={fw.value} value={fw.value}>
                  {fw.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {data && (
          <>
            <CoverageMatrix analysis={data} />
            <GapList gaps={data.gaps} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
