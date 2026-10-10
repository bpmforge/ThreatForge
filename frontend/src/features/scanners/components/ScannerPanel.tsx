"use client";

import { useState } from "react";
import {
  useFindings,
  useFindingStats,
  useScanHistory,
  useScannerMutations,
} from "../hooks/useScanners";
import type { ScannerType, FindingSeverity, FindingStatus } from "../types";
import { FindingsStats } from "./FindingsStats";
import { FindingCard } from "./FindingCard";
import { ScanConfigDialog } from "./ScanConfigDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Plus,
  RefreshCw,
  Shield,
  History,
  AlertTriangle,
  Filter,
} from "lucide-react";

interface ScannerPanelProps {
  projectId: string;
  threatModelId?: string;
}

export function ScannerPanel({ projectId, threatModelId }: ScannerPanelProps) {
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scannerFilter, setScannerFilter] = useState<ScannerType | "ALL">(
    "ALL",
  );
  const [severityFilter] = useState<FindingSeverity[]>([]);
  const [statusFilter, setStatusFilter] = useState<FindingStatus | undefined>();

  const { data: stats } = useFindingStats(projectId);
  const {
    data: findings,
    isLoading: findingsLoading,
    refetch,
  } = useFindings(projectId, {
    scannerType: scannerFilter === "ALL" ? undefined : scannerFilter,
    severity: severityFilter.length > 0 ? severityFilter : undefined,
    status: statusFilter,
  });
  const { data: history, isLoading: historyLoading } =
    useScanHistory(projectId);
  const { updateFindingStatus } = useScannerMutations();

  const handleStatusChange = (findingId: string, status: FindingStatus) => {
    updateFindingStatus({ projectId, findingId, status });
  };

  const scannerTypes: ScannerType[] = [
    "SNYK",
    "SONARQUBE",
    "CHECKMARX",
    "VERACODE",
    "OWASP_ZAP",
    "BURP",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Security Scanners</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            aria-label="Refresh findings"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setScanDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Run Scan
          </Button>
        </div>
      </div>

      {stats && <FindingsStats stats={stats} />}

      <Tabs defaultValue="findings" className="w-full">
        <TabsList>
          <TabsTrigger value="findings" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Findings ({stats?.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1">
            <History className="h-3 w-3" />
            Scan History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={scannerFilter}
              onValueChange={(v) => setScannerFilter(v as ScannerType | "ALL")}
            >
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Scanner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Scanners</SelectItem>
                {scannerTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter ?? "ALL"}
              onValueChange={(v) =>
                setStatusFilter(v === "ALL" ? undefined : (v as FindingStatus))
              }
            >
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="FIXED">Fixed</SelectItem>
                <SelectItem value="DISMISSED">Dismissed</SelectItem>
                <SelectItem value="FALSE_POSITIVE">False Positive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {findingsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading findings...
            </div>
          ) : findings?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No findings found</p>
                <p className="text-sm">Run a scan to detect security issues</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {findings?.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {historyLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading history...
            </div>
          ) : history?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No scan history</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {history?.map((run) => (
                <Card key={run.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{run.scannerType}</Badge>
                        <Badge
                          className={cn(
                            run.status === "COMPLETED" &&
                              "bg-green-100 text-green-800",
                            run.status === "RUNNING" &&
                              "bg-blue-100 text-blue-800",
                            run.status === "FAILED" &&
                              "bg-red-100 text-red-800",
                          )}
                        >
                          {run.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(run.startedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span>Total: {run.totalFindings}</span>
                      {run.criticalCount > 0 && (
                        <span className="text-red-600">
                          Critical: {run.criticalCount}
                        </span>
                      )}
                      {run.highCount > 0 && (
                        <span className="text-orange-600">
                          High: {run.highCount}
                        </span>
                      )}
                      {run.mediumCount > 0 && (
                        <span className="text-yellow-600">
                          Medium: {run.mediumCount}
                        </span>
                      )}
                    </div>
                    {run.error && (
                      <p className="text-xs text-red-600 mt-1">{run.error}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ScanConfigDialog
        projectId={projectId}
        threatModelId={threatModelId}
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
      />
    </div>
  );
}
