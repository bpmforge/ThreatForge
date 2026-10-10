"use client";

/**
 * ProviderCard - Sortable AI provider card component.
 */
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { DraggableAttributes } from "@dnd-kit/core";
import {
  Loader2,
  Settings2,
  Trash2,
  PlayCircle,
  CheckCircle2,
  XCircle,
  GripVertical,
  Star,
  StarOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { AIProviderConfig } from "../types";
import { AI_PROVIDER_TYPES } from "../types";

interface ProviderCardProps {
  provider: AIProviderConfig;
  index: number;
  canEdit: boolean;
  isTesting: boolean;
  onTest: () => void;
  onToggleEnabled: () => void;
  onSetDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
  dragHandleProps?: {
    attributes: DraggableAttributes;
    listeners: SyntheticListenerMap | undefined;
  };
}

function ProviderCard({
  provider,
  index,
  canEdit,
  isTesting,
  onTest,
  onToggleEnabled,
  onSetDefault,
  onEdit,
  onDelete,
  dragHandleProps,
}: ProviderCardProps) {
  const providerInfo = AI_PROVIDER_TYPES.find((p) => p.value === provider.type);

  return (
    <Card className={!provider.isEnabled ? "opacity-60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {canEdit && (
              <div
                className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
                {...(dragHandleProps?.attributes || {})}
                {...(dragHandleProps?.listeners || {})}
              >
                <GripVertical className="h-5 w-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{provider.name}</CardTitle>
                {provider.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  Priority {index + 1}
                </Badge>
              </div>
              <CardDescription>
                {providerInfo?.label || provider.type}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {provider.lastTestStatus && (
              <Badge
                variant={
                  provider.lastTestStatus === "SUCCESS"
                    ? "default"
                    : "destructive"
                }
                className="text-xs"
              >
                {provider.lastTestStatus === "SUCCESS" ? (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                ) : (
                  <XCircle className="h-3 w-3 mr-1" />
                )}
                {provider.lastTestStatus}
              </Badge>
            )}
            {canEdit && (
              <Switch
                checked={provider.isEnabled}
                onCheckedChange={onToggleEnabled}
                aria-label={`${provider.isEnabled ? "Disable" : "Enable"} provider`}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {provider.model && <span>Model: {provider.model}</span>}
            {provider.hasApiKey && <span>API Key: ••••••••</span>}
            {provider.baseUrl && <span>URL: {provider.baseUrl}</span>}
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onTest}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                <span className="ml-1.5">Test</span>
              </Button>
              {!provider.isDefault && (
                <Button variant="ghost" size="sm" onClick={onSetDefault}>
                  <StarOff className="h-4 w-4" />
                  <span className="ml-1.5 sr-only">Set Default</span>
                </Button>
              )}
              {provider.isDefault && (
                <Button variant="ghost" size="sm" disabled>
                  <Star className="h-4 w-4 text-yellow-500" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Settings2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>
        {provider.lastTestError && (
          <p className="mt-2 text-xs text-destructive">
            {provider.lastTestError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Sortable wrapper for ProviderCard
type SortableProviderCardProps = Omit<ProviderCardProps, "dragHandleProps">;

export function SortableProviderCard(props: SortableProviderCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.provider.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ProviderCard
        {...props}
        dragHandleProps={props.canEdit ? { attributes, listeners } : undefined}
      />
    </div>
  );
}
