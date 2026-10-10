"use client";

import React from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import type { PromptExecutionLog, ExecutionStatus } from "../types";

export const STATUS_ICONS: Record<ExecutionStatus, React.ReactNode> = {
  PENDING: <Clock className="h-4 w-4 text-yellow-500" />,
  RUNNING: <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />,
  COMPLETED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  FAILED: <XCircle className="h-4 w-4 text-red-500" />,
  CANCELLED: <AlertCircle className="h-4 w-4 text-gray-500" />,
};

export const STATUS_LABELS: Record<ExecutionStatus, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

interface ExecutionLogRowProps {
  log: PromptExecutionLog;
  onSelect: () => void;
}

export function ExecutionLogRow({ log, onSelect }: ExecutionLogRowProps) {
  const formattedTime = new Date(log.createdAt).toLocaleString();

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onSelect}>
      <TableCell className="font-medium truncate max-w-[180px]">
        {log.promptTemplateName}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {STATUS_ICONS[log.status]}
          <span className="text-sm">{STATUS_LABELS[log.status]}</span>
        </div>
      </TableCell>
      <TableCell>
        {log.durationMs ? `${log.durationMs.toLocaleString()}ms` : "-"}
      </TableCell>
      <TableCell>{log.tokensUsed?.toLocaleString() ?? "-"}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formattedTime}
      </TableCell>
      <TableCell>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}
