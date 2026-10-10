/**
 * ModelCard - Threat model card for dashboard grid
 */
"use client";

import { useState, useEffect, memo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  MoreVertical,
  ShieldCheck,
  Trash2,
  Copy,
  ExternalLink,
  FolderInput,
  Target,
} from "lucide-react";
import type { ThreatModelSummary } from "../types";

interface ModelCardProps {
  model: ThreatModelSummary;
  onDelete?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
  onMove?: (id: string, name: string, currentProjectId?: string) => void;
  onFocus?: () => void;
  /** Number of users currently collaborating (from presence API) */
  activeCount?: number;
}

type HealthStatus = "critical" | "at-risk" | "healthy";

function getHealthStatus(model: ThreatModelSummary): HealthStatus {
  if (
    model.openThreatCount > 0 &&
    ((model.criticalThreatCount ?? 0) > 0 || (model.highThreatCount ?? 0) > 0)
  ) {
    return "critical";
  }
  if (model.openThreatCount > 0) return "at-risk";
  return "healthy";
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

const HEALTH_CONFIG = {
  critical: {
    label: "Critical",
    icon: AlertTriangle,
    className:
      "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950 dark:border-red-900",
  },
  "at-risk": {
    label: "At Risk",
    icon: AlertTriangle,
    className:
      "text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950 dark:border-amber-900",
  },
  healthy: {
    label: "Healthy",
    icon: ShieldCheck,
    className:
      "text-green-800 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-950 dark:border-green-900",
  },
} as const;

export const ModelCard = memo(function ModelCard({
  model,
  onDelete,
  onDuplicate,
  onMove,
  onFocus,
  activeCount,
}: ModelCardProps) {
  const router = useRouter();
  // Defer relative time to avoid #418 — formatRelativeTime uses new Date()
  // which differs between SSR and client hydration. suppressHydrationWarning
  // only suppresses warnings, not the thrown #418 error in React 19.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const health = getHealthStatus(model);
  const {
    label: healthLabel,
    icon: HealthIcon,
    className: healthClass,
  } = HEALTH_CONFIG[health];

  const handleOpen = () => {
    router.push(`/models/${model.id}`);
  };

  return (
    <Card
      className="group hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleOpen}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold group-hover:text-blue-600 transition-colors">
            {model.name}
          </CardTitle>
          <CardDescription className="text-xs">
            v{model.version}
            {model.projectName && ` · ${model.projectName}`}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${healthClass}`}
            title={`Health: ${healthLabel}`}
          >
            <HealthIcon className="h-3 w-3" />
            {healthLabel}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Actions for ${model.name}`}
              >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpen();
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </DropdownMenuItem>
              {onFocus && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocus();
                  }}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Focus Stats
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate?.(model.id);
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onMove?.(model.id, model.name, model.projectId);
                }}
              >
                <FolderInput className="h-4 w-4 mr-2" />
                Move to Project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(model.id, model.name);
                }}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            {model.openThreatCount > 0 ? (
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" />
                {model.openThreatCount} open
              </span>
            ) : model.threatCount > 0 ? (
              <span className="text-green-600">
                {model.threatCount} mitigated
              </span>
            ) : (
              <span>No threats</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeCount && activeCount > 0 ? (
              <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                {activeCount} active
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {mounted ? formatRelativeTime(model.lastModified) : ""}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
