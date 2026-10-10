"use client";

/**
 * Supply Chain Analysis Page (A12)
 *
 * Paste or upload a dependency manifest (package.json, requirements.txt,
 * go.mod, pom.xml, Cargo.toml) and scan for known CVEs via NVD.
 */
import { getErrorMessage } from "@/lib/errors";
import { severityBadge, toSeverity } from "@/lib/severity";
import { useState, useRef } from "react";
import { AppHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiPost } from "@/lib/api-client";
import {
  Package,
  Upload,
  AlertTriangle,
  CircleHelp,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface DepVulnResult {
  dependency: { name: string; version: string; ecosystem: string };
  cves: Array<{
    id: string;
    description: string;
    /** Matches the server's field; absent when NVD gave no CVSS v3.1 score. */
    cvss?: number;
    severity: string;
  }>;
  /** NONE = NVD returned no CVEs; UNKNOWN = lookup failed or was skipped. */
  riskLevel: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
  unknownReason?: "lookup_failed" | "not_checked";
}

interface ScanReport {
  totalDependencies: number;
  vulnerableDependencies: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  unknownCount: number;
  dependencies: DepVulnResult[];
  scannedAt: string;
}

function DepRow({ item }: { item: DepVulnResult }) {
  const [open, setOpen] = useState(false);
  const hasCves = item.cves.length > 0;
  const isUnknown = item.riskLevel === "UNKNOWN";
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
        onClick={() => hasCves && setOpen((v) => !v)}
      >
        {hasCves ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : isUnknown ? (
          <CircleHelp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-green-500" />
        )}
        <span className="font-medium flex-1 text-left">
          {item.dependency.name}
          <span className="font-normal text-muted-foreground ml-1.5">
            {item.dependency.version}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {item.dependency.ecosystem}
        </span>
        {isUnknown ? (
          <span className="text-[11px] px-2 py-0.5 rounded border font-medium bg-muted text-muted-foreground">
            Unknown — not checked
          </span>
        ) : (
          <span
            className={`text-[11px] px-2 py-0.5 rounded border font-medium ${severityBadge({ severity: toSeverity(item.riskLevel), variant: "soft" })}`}
          >
            {item.riskLevel}
          </span>
        )}
        {hasCves && (
          <span className="text-xs text-muted-foreground">
            {item.cves.length} CVE{item.cves.length !== 1 ? "s" : ""}
          </span>
        )}
      </button>
      {open && hasCves && (
        <div className="px-4 pb-3 space-y-2 border-t bg-muted/20">
          {item.cves.map((cve) => (
            <div key={cve.id} className="flex items-start gap-2 pt-2">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium">
                    {cve.id}
                  </span>
                  {cve.cvss != null && (
                    <Badge variant="outline" className="text-[10px] px-1">
                      CVSS {cve.cvss.toFixed(1)}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {cve.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SupplyChainPage() {
  const [content, setContent] = useState("");
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setContent(await file.text());
  };

  const handleScan = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost<ScanReport>("/api/supply-chain/scan", {
        content,
        filename: filename || undefined,
        scanNVD: true,
      });
      setReport(data);
    } catch (e) {
      setError(getErrorMessage(e, "Scan failed"));
    } finally {
      setLoading(false);
    }
  };

  // UNKNOWN means not verified: never count it as clean or as vulnerable.
  const vulnerable =
    report?.dependencies.filter(
      (d) => d.riskLevel !== "NONE" && d.riskLevel !== "UNKNOWN",
    ) ?? [];
  const unknown =
    report?.dependencies.filter((d) => d.riskLevel === "UNKNOWN") ?? [];
  const clean =
    report?.dependencies.filter((d) => d.riskLevel === "NONE") ?? [];

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Package className="h-6 w-6" />
              Supply Chain Analysis
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Paste or upload a dependency manifest to scan for known
              vulnerabilities (NVD CVE database).
            </p>
          </div>

          {/* Input */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.txt,.mod,.xml,.toml,.lock,.gradle"
                className="hidden"
                onChange={handleFile}
              />
              {filename && (
                <span className="text-sm text-muted-foreground">
                  {filename}
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                Supports: package.json, requirements.txt, go.mod, pom.xml,
                Cargo.toml
              </span>
            </div>
            <Textarea
              placeholder="Or paste dependency file content here…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="font-mono text-xs"
              aria-label="Dependency file content"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              onClick={handleScan}
              disabled={!content.trim() || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scanning…
                </>
              ) : (
                "Scan Dependencies"
              )}
            </Button>
          </div>

          {/* Report */}
          {report && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  {
                    label: "Total",
                    value: report.totalDependencies,
                    cls: "",
                  },
                  {
                    label: "Vulnerable",
                    value: report.vulnerableDependencies,
                    cls:
                      report.vulnerableDependencies > 0
                        ? "text-red-600"
                        : "text-green-600",
                  },
                  {
                    label: "Critical",
                    value: report.criticalCount,
                    cls: report.criticalCount > 0 ? "text-red-600" : "",
                  },
                  {
                    label: "High",
                    value: report.highCount,
                    cls: report.highCount > 0 ? "text-orange-600" : "",
                  },
                  {
                    label: "Not checked",
                    value: report.unknownCount,
                    cls: "",
                  },
                ].map(({ label, value, cls }) => (
                  <div
                    key={label}
                    className="rounded-lg border p-3 text-center"
                  >
                    <div className={`text-2xl font-bold ${cls}`}>{value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {report.unknownCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {report.unknownCount === 1
                    ? "1 dependency was"
                    : `${report.unknownCount} dependencies were`}{" "}
                  not checked: NVD lookups failed or were skipped by the
                  per-scan lookup limit. Setting NVD_API_KEY on the server
                  raises the NVD rate limit.
                </p>
              )}

              {/* Vulnerable dependencies */}
              {vulnerable.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Vulnerable Dependencies ({vulnerable.length})
                  </h2>
                  {vulnerable.map((item) => (
                    <DepRow
                      key={`${item.dependency.name}@${item.dependency.version}`}
                      item={item}
                    />
                  ))}
                </div>
              )}

              {/* Unverified dependencies */}
              {unknown.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <CircleHelp className="h-4 w-4 text-muted-foreground" />
                    Not checked ({unknown.length})
                  </h2>
                  {unknown.map((item) => (
                    <DepRow
                      key={`${item.dependency.name}@${item.dependency.version}`}
                      item={item}
                    />
                  ))}
                </div>
              )}

              {/* Clean dependencies */}
              {clean.length > 0 && (
                <details className="group">
                  <summary className="text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2 list-none">
                    <ChevronRight className="h-3.5 w-3.5 group-open:rotate-90 transition-transform" />
                    Clean dependencies ({clean.length})
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    {clean.map((item) => (
                      <DepRow
                        key={`${item.dependency.name}@${item.dependency.version}`}
                        item={item}
                      />
                    ))}
                  </div>
                </details>
              )}

              <p className="text-xs text-muted-foreground">
                Scanned {new Date(report.scannedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
