"use client";

/**
 * Notifications Page — shows recent notifications with read/unread state.
 */
import { AppHeader, type BreadcrumbItem } from "@/components/layout";
import { NotificationList, useNotifications } from "@/features/notifications";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  const breadcrumbs: BreadcrumbItem[] = [{ label: "Notifications" }];
  const { notifications, isLoading, markAsRead, markAllRead } =
    useNotifications();

  return (
    <>
      <AppHeader breadcrumbs={breadcrumbs} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Notifications
              </h1>
              <p className="text-muted-foreground text-sm">
                Stay updated on threat model changes, security alerts, and
                reviews.
              </p>
            </div>
            {notifications.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => markAllRead()}>
                Mark all read
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No notifications yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                You&apos;ll see updates here when threat models change or
                reviews are requested.
              </p>
            </div>
          ) : (
            <NotificationList
              notifications={notifications}
              onRead={(id) => markAsRead(id)}
            />
          )}
        </div>
      </main>
    </>
  );
}
