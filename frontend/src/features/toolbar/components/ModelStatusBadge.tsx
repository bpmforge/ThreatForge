"use client";

/**
 * ModelStatusBadge - Display and update model lifecycle status
 */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { badgeVariants } from "@/components/ui/badge";
import { useUpdateModelStatus, type ModelStatus } from "@/features/dashboard";
import { cn } from "@/lib/utils";
import { FileEdit, Eye, CheckCircle, Archive, ChevronDown } from "lucide-react";

interface ModelStatusBadgeProps {
  modelId: string;
  status: ModelStatus;
}

const STATUS_CONFIG: Record<
  ModelStatus,
  {
    label: string;
    icon: typeof FileEdit;
    className: string;
    description: string;
  }
> = {
  DRAFT: {
    label: "Draft",
    icon: FileEdit,
    className:
      "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
    description: "Work in progress",
  },
  IN_REVIEW: {
    label: "In Review",
    icon: Eye,
    className:
      "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
    description: "Under review",
  },
  PUBLISHED: {
    label: "Published",
    icon: CheckCircle,
    className:
      "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400",
    description: "Approved and finalized",
  },
  ARCHIVED: {
    label: "Archived",
    icon: Archive,
    className:
      "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700/50 dark:text-gray-400",
    description: "No longer active",
  },
};

export function ModelStatusBadge({ modelId, status }: ModelStatusBadgeProps) {
  const updateStatus = useUpdateModelStatus();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const Icon = config.icon;

  const handleStatusChange = (newStatus: ModelStatus) => {
    if (newStatus !== status) {
      updateStatus.mutate({ id: modelId, status: newStatus });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Model status: ${config.label}. Change status`}
          className={cn(
            badgeVariants({ variant: "outline" }),
            "cursor-pointer transition-colors flex items-center gap-1 px-2 py-0.5",
            config.className,
          )}
        >
          <Icon className="h-3 w-3" />
          <span className="text-xs">{config.label}</span>
          <ChevronDown className="h-3 w-3 ml-0.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {(Object.keys(STATUS_CONFIG) as ModelStatus[]).map((statusKey) => {
          const statusConfig = STATUS_CONFIG[statusKey];
          const StatusIcon = statusConfig.icon;
          const isActive = statusKey === status;

          return (
            <DropdownMenuItem
              key={statusKey}
              onClick={() => handleStatusChange(statusKey)}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                isActive && "bg-muted",
              )}
            >
              <StatusIcon className="h-4 w-4" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {statusConfig.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {statusConfig.description}
                </span>
              </div>
              {isActive && (
                <CheckCircle className="h-4 w-4 ml-auto text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
