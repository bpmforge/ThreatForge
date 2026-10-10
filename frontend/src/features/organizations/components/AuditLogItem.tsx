"use client";

import { User, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AuditLog } from "../hooks/useAuditLogViewer";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE: { label: "Created", color: "bg-green-100 text-green-800" },
  UPDATE: { label: "Updated", color: "bg-blue-100 text-blue-800" },
  DELETE: { label: "Deleted", color: "bg-red-100 text-red-800" },
  VIEW: { label: "Viewed", color: "bg-gray-100 text-gray-800" },
  EXPORT: { label: "Exported", color: "bg-purple-100 text-purple-800" },
  SHARE: { label: "Shared", color: "bg-yellow-100 text-yellow-800" },
  LOGIN: { label: "Logged In", color: "bg-green-100 text-green-800" },
  LOGOUT: { label: "Logged Out", color: "bg-gray-100 text-gray-800" },
  INVITE: { label: "Invited", color: "bg-blue-100 text-blue-800" },
  ACCEPT_INVITE: {
    label: "Accepted Invite",
    color: "bg-green-100 text-green-800",
  },
  DECLINE_INVITE: {
    label: "Declined Invite",
    color: "bg-red-100 text-red-800",
  },
  SUSPEND: { label: "Suspended", color: "bg-red-100 text-red-800" },
  UNSUSPEND: { label: "Unsuspended", color: "bg-green-100 text-green-800" },
};

export function AuditLogItem({ log }: { log: AuditLog }) {
  const config = ACTION_LABELS[log.action] ?? {
    label: log.action,
    color: "bg-gray-100 text-gray-800",
  };
  const formattedDate = new Date(log.createdAt).toLocaleString();

  return (
    <div className="p-4 rounded-lg border flex items-start justify-between hover:bg-muted/50">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={config.color}>
            {config.label}
          </Badge>
          <span className="font-medium text-sm">
            {log.resourceType.replace(/_/g, " ")}
          </span>
          {log.resourceName && (
            <span className="text-muted-foreground text-sm">
              &quot;{log.resourceName}&quot;
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {log.userEmail}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formattedDate}
          </span>
        </div>
      </div>
    </div>
  );
}
