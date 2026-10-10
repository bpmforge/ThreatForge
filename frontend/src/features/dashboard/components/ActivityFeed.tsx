/**
 * ActivityFeed - Recent activity timeline
 */
"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileEdit,
  FilePlus,
  AlertTriangle,
  CheckCircle,
  Activity,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRecentActivity } from "../hooks/useDashboard";
import type { RecentActivity } from "../types";

const activityIcons: Record<RecentActivity["type"], typeof FileEdit> = {
  model_created: FilePlus,
  model_updated: FileEdit,
  threat_added: AlertTriangle,
  threat_mitigated: CheckCircle,
};

const activityColors: Record<RecentActivity["type"], string> = {
  model_created: "text-green-600",
  model_updated: "text-blue-600",
  threat_added: "text-amber-600",
  threat_mitigated: "text-green-600",
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffInMinutes < 1) return "just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;

  return date.toLocaleDateString();
}

interface ActivityFeedProps {
  organizationId?: string;
}

export function ActivityFeed({ organizationId }: ActivityFeedProps) {
  const router = useRouter();
  const { data: activities, isLoading } = useRecentActivity(organizationId);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleActivityClick = (activity: RecentActivity) => {
    router.push(`/models/${activity.modelId}`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-64">
          {isLoading ? (
            <div className="space-y-3 px-4 py-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-4 w-4 mt-0.5 rounded" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : !activities?.length ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
              <Activity className="h-8 w-8 mb-2 opacity-50" />
              <p>No recent activity</p>
              <p className="text-xs">Activity will appear here as you work</p>
            </div>
          ) : (
            <div className="space-y-1 px-4 pb-4">
              {activities.map((activity) => {
                const Icon = activityIcons[activity.type];
                const color = activityColors[activity.type];

                return (
                  <button
                    key={activity.id}
                    onClick={() => handleActivityClick(activity)}
                    className="w-full flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                  >
                    <Icon className={`h-4 w-4 mt-0.5 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {mounted ? formatTime(activity.timestamp) : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
