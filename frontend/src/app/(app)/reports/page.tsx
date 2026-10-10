"use client";

import {
  FileBarChart,
  FileText,
  ShieldCheck,
  BarChart3,
  Loader2,
  FileCode,
} from "lucide-react";
import { AppHeader, type BreadcrumbItem } from "@/components/layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useReportsPage } from "./useReportsPage";
import { useReportExports } from "./useReportExports";
import { ReportsSelectors } from "./ReportsSelectors";

export default function ReportsPage() {
  const breadcrumbs: BreadcrumbItem[] = [{ label: "Reports" }];
  const p = useReportsPage();
  const x = useReportExports(p.selectedModelId);

  const reportTypes = [
    {
      id: "full",
      title: "Full Threat Report",
      description:
        "Comprehensive PDF with diagram, all identified threats, mitigations, and STRIDE breakdown.",
      icon: FileText,
      action: x.handleGenerateFullReport,
      requiresModel: true,
    },
    {
      id: "executive",
      title: "Executive Summary",
      description:
        "High-level overview with risk rating, key findings, and top recommendations for leadership.",
      icon: FileBarChart,
      action: x.handleGenerateExecutiveSummary,
      requiresModel: true,
    },
    {
      id: "code",
      title: "Export as Code (YAML)",
      description:
        "Download a security-focused threatmodel.yaml you can commit to git and validate in CI.",
      icon: FileCode,
      action: x.handleExportAsCode,
      requiresModel: true,
    },
    {
      id: "compliance",
      title: "Compliance Report",
      description:
        "Map threats and mitigations to compliance frameworks such as SOC 2, NIST, ISO 27001, and HIPAA.",
      icon: ShieldCheck,
      action: x.handleComplianceReport,
      requiresModel: false,
    },
    {
      id: "risk",
      title: "Risk Assessment",
      description:
        "Visual risk dashboard with severity distribution, STRIDE breakdown, and mitigation progress.",
      icon: BarChart3,
      action: x.handleRiskAssessment,
      requiresModel: false,
    },
  ];

  return (
    <>
      <AppHeader breadcrumbs={breadcrumbs} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Reports</h1>
            <p className="text-muted-foreground">
              Generate and export security assessment reports from your threat
              models.
            </p>
          </div>

          <ReportsSelectors state={p} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reportTypes.map((report) => {
              const Icon = report.icon;
              const isGenerating = x.generating === report.id;
              const disabled = report.requiresModel && !p.hasSelection;

              return (
                <Card key={report.id}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-muted p-2">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">
                          {report.title}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {report.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={report.action}
                      disabled={disabled || isGenerating}
                      variant={disabled ? "outline" : "default"}
                      className="w-full"
                      aria-label={`Generate ${report.title}`}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Generate"
                      )}
                    </Button>
                    {disabled && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Select a project and model above
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
