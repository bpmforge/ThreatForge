"use client";

import {
  Webhook,
  AlertTriangle,
  Play,
  Edit2,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface WebhookData {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  hasSecret: boolean;
  maxRetries: number;
  lastTriggeredAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  consecutiveFailures: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  event: string;
  resource: string;
  action: string;
  description: string;
}

interface WebhookCardProps {
  webhook: WebhookData;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onToggle: (active: boolean) => void;
}

export function WebhookCard({
  webhook,
  canEdit,
  onEdit,
  onDelete,
  onTest,
  onToggle,
}: WebhookCardProps) {
  const successRate =
    webhook.totalDeliveries > 0
      ? Math.round(
          (webhook.successfulDeliveries / webhook.totalDeliveries) * 100,
        )
      : null;

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${webhook.isActive ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}
          >
            <Webhook
              className={`h-5 w-5 ${webhook.isActive ? "text-green-600" : "text-muted-foreground"}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{webhook.name}</h4>
              {!webhook.isActive && (
                <Badge variant="secondary" className="text-xs">
                  Disabled
                </Badge>
              )}
              {webhook.consecutiveFailures >= 3 && (
                <Badge variant="destructive" className="text-xs gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Failing
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate max-w-xs">
              {webhook.url}
            </p>
          </div>
        </div>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Webhook actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onTest}>
                <Play className="h-4 w-4 mr-2" />
                Test Webhook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {webhook.events.slice(0, 3).map((event) => (
          <Badge key={event} variant="outline" className="text-xs">
            {event}
          </Badge>
        ))}
        {webhook.events.length > 3 && (
          <Badge variant="outline" className="text-xs">
            +{webhook.events.length - 3} more
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm pt-2 border-t">
        <div>
          <span className="text-muted-foreground">Deliveries</span>
          <p className="font-medium">{webhook.totalDeliveries}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Success Rate</span>
          <p className="font-medium">
            {successRate !== null ? `${successRate}%` : "-"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Last Triggered</span>
          <p className="font-medium text-xs">
            {webhook.lastTriggeredAt
              ? new Date(webhook.lastTriggeredAt).toLocaleDateString()
              : "Never"}
          </p>
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">Active</span>
          <Switch checked={webhook.isActive} onCheckedChange={onToggle} />
        </div>
      )}
    </div>
  );
}
