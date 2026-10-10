/**
 * AuditLogTable - Display audit log entries
 */
"use client";

import { PaginationFooter } from "@/components/PaginationFooter";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useAuditLog } from "../hooks/useAdmin";
import { AuditLogFilters } from "./AuditLogFilters";
import {
  actionColors,
  entityIcons,
  formatDetails,
} from "./audit-log-constants";

export function AuditLogTable() {
  const [entityType, setEntityType] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useAuditLog({
    entityType: entityType || undefined,
    action: action || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit,
  });

  const formatTimestamp = (timestamp: string) =>
    new Date(timestamp).toLocaleString();

  const formatAction = (actionStr: string) =>
    actionStr.replace(/_/g, " ").toLowerCase();

  const handleClearFilters = () => {
    setEntityType("");
    setAction("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        Failed to load audit log: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AuditLogFilters
        entityType={entityType}
        action={action}
        startDate={startDate}
        endDate={endDate}
        onEntityTypeChange={(v) => {
          setEntityType(v);
          setPage(1);
        }}
        onActionChange={(v) => {
          setAction(v);
          setPage(1);
        }}
        onStartDateChange={(v) => {
          setStartDate(v);
          setPage(1);
        }}
        onEndDateChange={(v) => {
          setEndDate(v);
          setPage(1);
        }}
        onClear={handleClearFilters}
      />

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Loading audit log...
                </TableCell>
              </TableRow>
            ) : data?.entries?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  No audit entries found
                </TableCell>
              </TableRow>
            ) : (
              data?.entries?.map((entry) => {
                const details = entry.details as Record<string, unknown> | null;
                const hasDetails = details && Object.keys(details).length > 0;
                const isExpanded = expandedRow === entry.id;

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(entry.timestamp)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">
                          {entry.userName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entry.userEmail}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          actionColors[entry.action] ??
                          "bg-muted text-foreground"
                        }
                      >
                        {entry.action ? formatAction(entry.action) : "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span aria-hidden="true">
                          {entry.entityType
                            ? entityIcons[entry.entityType]
                            : "\u{1F4CB}"}
                        </span>
                        <div>
                          <div className="text-sm">
                            {entry.entityType
                              ?.replace(/_/g, " ")
                              .toLowerCase() ?? "unknown"}
                          </div>
                          {entry.entityName && (
                            <div className="text-xs text-muted-foreground">
                              {entry.entityName}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm max-w-xs">
                      {hasDetails ? (
                        <button
                          onClick={() =>
                            setExpandedRow(isExpanded ? null : entry.id)
                          }
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 shrink-0" />
                          )}
                          {isExpanded ? (
                            <pre className="text-xs whitespace-pre-wrap font-mono">
                              {formatDetails(details)}
                            </pre>
                          ) : (
                            <span className="text-xs truncate">
                              {Object.keys(details!).length} fields
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.total > limit && (
        <PaginationFooter
          page={page}
          limit={limit}
          total={data.total}
          noun="entries"
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
