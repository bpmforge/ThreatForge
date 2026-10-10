"use client";

import type { Notification } from "../types";
import { NotificationItem } from "./NotificationItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell } from "lucide-react";

interface NotificationListProps {
  notifications: Notification[];
  onRead: (id: string) => void;
  onDelete?: (id: string) => void;
  maxHeight?: string;
}

export function NotificationList({
  notifications,
  onRead,
  onDelete,
  maxHeight = "400px",
}: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Bell className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No notifications</p>
      </div>
    );
  }

  return (
    <ScrollArea style={{ maxHeight }} className="group">
      <div className="divide-y">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onRead={onRead}
            onDelete={onDelete}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
