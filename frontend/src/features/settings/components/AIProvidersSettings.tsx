"use client";

/**
 * AIProvidersSettings - Multi-provider AI configuration panel.
 *
 * Allows organization owners/admins to configure multiple AI providers
 * with priority ordering, test connections, and view usage stats.
 */
import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Loader2, Settings2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  useAIProviders,
  useUpdateAIProvider,
  useDeleteAIProvider,
  useTestAIProvider,
  useReorderAIProviders,
} from "../hooks/useAIProviders";
import type { AIProviderConfig } from "../types";
import { SortableProviderCard } from "./ProviderCard";
import { AddProviderDialog } from "./AddProviderDialog";
import { EditProviderDialog } from "./EditProviderDialog";
import { getErrorMessage } from "@/lib/errors";

interface AIProvidersSettingsProps {
  orgId: string;
  canEdit: boolean;
}

export function AIProvidersSettings({
  orgId,
  canEdit,
}: AIProvidersSettingsProps) {
  const { data: providers, isLoading, error } = useAIProviders(orgId);
  const updateMutation = useUpdateAIProvider(orgId);
  const deleteMutation = useDeleteAIProvider(orgId);
  const testMutation = useTestAIProvider(orgId);
  const reorderMutation = useReorderAIProviders(orgId);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProvider, setEditingProvider] =
    useState<AIProviderConfig | null>(null);
  const [deletingProvider, setDeletingProvider] =
    useState<AIProviderConfig | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sortedProviders = [...(providers || [])].sort(
    (a, b) => a.priority - b.priority,
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !sortedProviders) return;

      const oldIndex = sortedProviders.findIndex((p) => p.id === active.id);
      const newIndex = sortedProviders.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedProviders = arrayMove(sortedProviders, oldIndex, newIndex);
      const providerIds = reorderedProviders.map((p) => p.id);

      try {
        await reorderMutation.mutateAsync(providerIds);
        toast.success("Provider order updated");
      } catch (err) {
        toast.error("Failed to reorder providers", {
          description: getErrorMessage(err, "Unknown error"),
        });
      }
    },
    [sortedProviders, reorderMutation],
  );

  const handleTestProvider = async (providerId: string) => {
    try {
      const result = await testMutation.mutateAsync(providerId);
      if (result.success) {
        toast.success("Connection successful", {
          description: `Latency: ${result.latencyMs}ms`,
        });
      } else {
        toast.error("Connection failed", {
          description: result.error || "Unable to connect to provider",
        });
      }
    } catch (err) {
      toast.error("Test failed", {
        description: getErrorMessage(err, "Unknown error"),
      });
    }
  };

  const handleToggleEnabled = async (provider: AIProviderConfig) => {
    try {
      await updateMutation.mutateAsync({
        providerId: provider.id,
        data: { isEnabled: !provider.isEnabled },
      });
      toast.success(
        provider.isEnabled ? "Provider disabled" : "Provider enabled",
      );
    } catch (err) {
      toast.error("Failed to update provider", {
        description: getErrorMessage(err, "Unknown error"),
      });
    }
  };

  const handleSetDefault = async (provider: AIProviderConfig) => {
    try {
      await updateMutation.mutateAsync({
        providerId: provider.id,
        data: { isDefault: true },
      });
      toast.success("Default provider updated");
    } catch (err) {
      toast.error("Failed to update default", {
        description: getErrorMessage(err, "Unknown error"),
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingProvider) return;
    try {
      await deleteMutation.mutateAsync(deletingProvider.id);
      toast.success("Provider deleted");
      setDeletingProvider(null);
    } catch (err) {
      toast.error("Failed to delete provider", {
        description: getErrorMessage(err, "Unknown error"),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive">
        <AlertCircle className="h-5 w-5 mr-2" />
        Failed to load AI providers
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Providers</h3>
          <p className="text-sm text-muted-foreground">
            Configure multiple AI providers with fallback ordering.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Provider
          </Button>
        )}
      </div>

      {sortedProviders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              No AI providers configured. Add a provider to enable AI features.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedProviders.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {sortedProviders.map((provider, index) => (
                <SortableProviderCard
                  key={provider.id}
                  provider={provider}
                  index={index}
                  canEdit={canEdit}
                  isTesting={
                    testMutation.isPending &&
                    testMutation.variables === provider.id
                  }
                  onTest={() => handleTestProvider(provider.id)}
                  onToggleEnabled={() => handleToggleEnabled(provider)}
                  onSetDefault={() => handleSetDefault(provider)}
                  onEdit={() => setEditingProvider(provider)}
                  onDelete={() => setDeletingProvider(provider)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add Provider Dialog */}
      <AddProviderDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        orgId={orgId}
      />

      {/* Edit Provider Dialog */}
      {editingProvider && (
        <EditProviderDialog
          open={true}
          onOpenChange={() => setEditingProvider(null)}
          orgId={orgId}
          provider={editingProvider}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingProvider}
        onOpenChange={() => setDeletingProvider(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingProvider?.name}
              &quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
