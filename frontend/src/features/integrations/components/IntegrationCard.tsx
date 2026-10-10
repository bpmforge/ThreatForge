"use client";

/**
 * Integration Card Component
 *
 * Displays an integration with its status and actions
 */
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UnverifiedBadge } from "./UnverifiedBadge";
import { DeleteAlertDialog } from "@/components/dialogs/DeleteAlertDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings,
  RefreshCw,
  Trash2,
  MoreVertical,
  Pause,
  Play,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  useDeleteIntegration,
  useTriggerSync,
  useUpdateJiraIntegration,
} from "../hooks/useIntegrations";
import type { Integration, IntegrationStatus } from "../types";

const STATUS_CONFIG: Record<
  IntegrationStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: typeof CheckCircle2;
  }
> = {
  ACTIVE: { label: "Active", variant: "default", icon: CheckCircle2 },
  INACTIVE: { label: "Inactive", variant: "secondary", icon: Pause },
  ERROR: { label: "Error", variant: "destructive", icon: AlertCircle },
  SUSPENDED: { label: "Suspended", variant: "outline", icon: Clock },
};

const INTEGRATION_ICONS: Record<string, string> = {
  JIRA: "🎫",
  GITHUB_ISSUES: "🐙",
  AZURE_DEVOPS: "🔷",
  LINEAR: "📊",
  ASANA: "📋",
  SLACK: "💬",
  TEAMS: "👥",
  CUSTOM_WEBHOOK: "🔗",
};

interface IntegrationCardProps {
  integration: Integration;
  orgId: string;
  onSettings?: () => void;
}

export function IntegrationCard({
  integration,
  orgId,
  onSettings,
}: IntegrationCardProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const deleteIntegration = useDeleteIntegration(orgId);
  const triggerSync = useTriggerSync(orgId, integration.id);
  const updateIntegration = useUpdateJiraIntegration(orgId, integration.id);

  const statusConfig = STATUS_CONFIG[integration.status];
  const StatusIcon = statusConfig.icon;

  const handleDelete = async () => {
    await deleteIntegration.mutateAsync(integration.id);
    setDeleteConfirmOpen(false);
  };

  const handleToggleStatus = async () => {
    const newStatus = integration.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await updateIntegration.mutateAsync({ status: newStatus });
  };

  const handleSync = async () => {
    await triggerSync.mutateAsync();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {INTEGRATION_ICONS[integration.type] || "🔌"}
              </span>
              <div>
                <CardTitle className="text-lg">{integration.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant={statusConfig.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                  <span className="text-xs">
                    {integration.type.replace("_", " ")}
                  </span>
                  <UnverifiedBadge type={integration.type} />
                </CardDescription>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onSettings && (
                  <DropdownMenuItem onClick={onSettings}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleSync}
                  disabled={triggerSync.isPending}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${triggerSync.isPending ? "animate-spin" : ""}`}
                  />
                  Sync Now
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleStatus}>
                  {integration.status === "ACTIVE" ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause Integration
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Activate Integration
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Last Synced</p>
              <p className="font-medium">
                {integration.lastSyncedAt
                  ? formatDistanceToNow(new Date(integration.lastSyncedAt), {
                      addSuffix: true,
                    })
                  : "Never"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Mapped Items</p>
              <p className="font-medium">{integration.mappingCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Sync Errors</p>
              <p
                className={`font-medium ${integration.syncErrors > 0 ? "text-destructive" : ""}`}
              >
                {integration.syncErrors}
              </p>
            </div>
          </div>

          {integration.lastSyncStatus &&
            integration.lastSyncStatus !== "SUCCESS" && (
              <div className="mt-3 p-2 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Last sync failed: {integration.lastSyncStatus}
              </div>
            )}
        </CardContent>
      </Card>

      <DeleteAlertDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleDelete}
        title="Delete Integration"
      >
        Are you sure you want to delete &quot;{integration.name}&quot;? This
        will remove all sync mappings and cannot be undone.
      </DeleteAlertDialog>
    </>
  );
}
