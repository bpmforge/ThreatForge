"use client";

import type { Notification } from "../types";
import { cn } from "@/lib/utils";
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Users,
  Shield,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function NotificationItem({
  notification,
  onRead,
  onDelete,
}: NotificationItemProps) {
  const getIcon = () => {
    const type = notification.type;
    if (type.startsWith("THREAT_"))
      return <AlertTriangle className="h-4 w-4" />;
    if (type.startsWith("MITIGATION_"))
      return <CheckCircle className="h-4 w-4" />;
    if (type.startsWith("MODEL_")) return <FileText className="h-4 w-4" />;
    if (type.startsWith("PROJECT_") || type.startsWith("ORG_"))
      return <Users className="h-4 w-4" />;
    if (
      type.startsWith("SCAN_") ||
      type.startsWith("VULNERABILITY") ||
      type === "CI_SCAN_FAILED"
    )
      return <Shield className="h-4 w-4" />;
    if (type === "COMMENT_ADDED" || type === "MENTION")
      return <MessageSquare className="h-4 w-4" />;
    return <Bell className="h-4 w-4" />;
  };

  const getPriorityColor = () => {
    switch (notification.priority) {
      case "URGENT":
        return "border-l-red-500";
      case "HIGH":
        return "border-l-orange-500";
      case "NORMAL":
        return "border-l-blue-500";
      default:
        return "border-l-gray-300";
    }
  };

  const relativeTime = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  const handleClick = () => {
    if (!notification.isRead) {
      onRead(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border-l-4",
        getPriorityColor(),
        !notification.isRead && "bg-primary/5",
        notification.link && "hover:bg-muted/50",
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <div className="mt-0.5 text-primary">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">{relativeTime}</p>
      </div>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          aria-label="Delete notification"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
