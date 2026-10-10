"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Webhook, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  WebhookCard,
  type WebhookData,
  type WebhookEvent,
} from "./WebhookCard";
import { WebhookFormDialog } from "./WebhookFormDialog";
import { useWebhookMutations } from "../hooks/useWebhookMutations";

interface WebhookManagerProps {
  orgId: string;
  canEdit: boolean;
}

export function WebhookManager({ orgId, canEdit }: WebhookManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookData | null>(
    null,
  );
  const [deletingWebhook, setDeletingWebhook] = useState<WebhookData | null>(
    null,
  );
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const { data: webhooks, isLoading } = useQuery<WebhookData[]>({
    queryKey: ["webhooks", orgId],
    queryFn: () =>
      apiGet<WebhookData[]>(`/api/organizations/${orgId}/webhooks`),
    enabled: !!orgId,
  });

  const { data: eventsData } = useQuery<{ events: WebhookEvent[] }>({
    queryKey: ["webhook-events"],
    queryFn: () => apiGet<{ events: WebhookEvent[] }>("/api/webhooks/events"),
  });

  function resetForm() {
    setName("");
    setUrl("");
    setSecret("");
    setSelectedEvents([]);
  }

  const { create, update, remove, test } = useWebhookMutations(orgId, {
    onCreateSuccess: () => {
      setShowCreateDialog(false);
      resetForm();
    },
    onUpdateSuccess: () => {
      setEditingWebhook(null);
      resetForm();
    },
    onDeleteSuccess: () => setDeletingWebhook(null),
  });

  function openEditDialog(webhook: WebhookData) {
    setEditingWebhook(webhook);
    setName(webhook.name);
    setUrl(webhook.url);
    setSecret("");
    setSelectedEvents(webhook.events);
  }

  function handleSubmit() {
    if (editingWebhook) {
      update.mutate({
        id: editingWebhook.id,
        data: {
          name,
          url,
          events: selectedEvents,
          ...(secret ? { secret } : {}),
        },
      });
    } else {
      create.mutate({
        name,
        url,
        events: selectedEvents,
        secret: secret || undefined,
      });
    }
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  const groupedEvents = eventsData?.events?.reduce(
    (acc, event) => {
      if (!acc[event.resource]) acc[event.resource] = [];
      acc[event.resource].push(event);
      return acc;
    },
    {} as Record<string, WebhookEvent[]>,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhooks
              </CardTitle>
              <CardDescription>
                Configure webhooks to send event notifications to external
                services.
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Webhook
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {webhooks && webhooks.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {webhooks.map((wh) => (
                <WebhookCard
                  key={wh.id}
                  webhook={wh}
                  canEdit={canEdit}
                  onEdit={() => openEditDialog(wh)}
                  onDelete={() => setDeletingWebhook(wh)}
                  onTest={() => test.mutate(wh.id)}
                  onToggle={(active) =>
                    update.mutate({ id: wh.id, data: { isActive: active } })
                  }
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No webhooks configured</p>
              <p className="text-sm">
                Add a webhook to start receiving event notifications.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <WebhookFormDialog
        open={showCreateDialog || !!editingWebhook}
        isEditing={!!editingWebhook}
        name={name}
        url={url}
        secret={secret}
        selectedEvents={selectedEvents}
        groupedEvents={groupedEvents}
        isPending={create.isPending || update.isPending}
        onNameChange={setName}
        onUrlChange={setUrl}
        onSecretChange={setSecret}
        onToggleEvent={toggleEvent}
        onSubmit={handleSubmit}
        onClose={() => {
          setShowCreateDialog(false);
          setEditingWebhook(null);
          resetForm();
        }}
      />

      <Dialog
        open={!!deletingWebhook}
        onOpenChange={() => setDeletingWebhook(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingWebhook?.name}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingWebhook(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deletingWebhook && remove.mutate(deletingWebhook.id)
              }
              disabled={remove.isPending}
            >
              {remove.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
