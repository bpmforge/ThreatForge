"use client";

import {
  FileText,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useAuditLogViewer } from "../hooks/useAuditLogViewer";
import { AuditLogFilterSheet } from "./AuditLogFilterSheet";
import { AuditLogItem } from "./AuditLogItem";

interface AuditLogViewerProps {
  organizationId: string;
  isOwner?: boolean;
}

export function AuditLogViewer({
  organizationId,
  isOwner = false,
}: AuditLogViewerProps) {
  const v = useAuditLogViewer(organizationId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Log
            </CardTitle>
            <CardDescription>
              View organization activity and audit trail
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <AuditLogFilterSheet
              action={v.action}
              resourceType={v.resourceType}
              startDate={v.startDate}
              endDate={v.endDate}
              onActionChange={(val) => {
                v.setAction(val);
                v.setPage(0);
              }}
              onResourceTypeChange={(val) => {
                v.setResourceType(val);
                v.setPage(0);
              }}
              onStartDateChange={(val) => {
                v.setStartDate(val);
                v.setPage(0);
              }}
              onEndDateChange={(val) => {
                v.setEndDate(val);
                v.setPage(0);
              }}
              onClear={v.clearFilters}
            />

            {isOwner && (
              <Select
                onValueChange={(format) =>
                  v.exportLogs(format as "csv" | "json")
                }
                disabled={v.isExporting}
              >
                <SelectTrigger className="w-[120px]">
                  {v.isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </>
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">Export CSV</SelectItem>
                  <SelectItem value="json">Export JSON</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {v.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : v.logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No activity logs found</p>
            {v.hasFilters && (
              <p className="text-sm mt-1">Try adjusting your filters</p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {v.logs.map((log) => (
                <AuditLogItem key={log.id} log={log} />
              ))}
            </div>

            {v.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  Showing {v.page * v.limit + 1}-
                  {Math.min((v.page + 1) * v.limit, v.total)} of {v.total}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => v.setPage(v.page - 1)}
                    disabled={v.page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {v.page + 1} of {v.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => v.setPage(v.page + 1)}
                    disabled={v.page >= v.totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
