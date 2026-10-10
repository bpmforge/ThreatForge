"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WebhookEvent } from "./WebhookCard";

interface WebhookFormDialogProps {
  open: boolean;
  isEditing: boolean;
  name: string;
  url: string;
  secret: string;
  selectedEvents: string[];
  groupedEvents: Record<string, WebhookEvent[]> | undefined;
  isPending: boolean;
  onNameChange: (v: string) => void;
  onUrlChange: (v: string) => void;
  onSecretChange: (v: string) => void;
  onToggleEvent: (event: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function WebhookFormDialog({
  open,
  isEditing,
  name,
  url,
  secret,
  selectedEvents,
  groupedEvents,
  isPending,
  onNameChange,
  onUrlChange,
  onSecretChange,
  onToggleEvent,
  onSubmit,
  onClose,
}: WebhookFormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Webhook" : "Create Webhook"}
          </DialogTitle>
          <DialogDescription>
            Configure a webhook to receive event notifications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-name">Name</Label>
            <Input
              id="webhook-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Slack Notifications"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Payload URL</Label>
            <Input
              id="webhook-url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com/webhook"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-secret">
              Secret {isEditing && "(leave empty to keep current)"}
            </Label>
            <Input
              id="webhook-secret"
              type="password"
              value={secret}
              onChange={(e) => onSecretChange(e.target.value)}
              placeholder="Optional signing secret"
            />
            <p className="text-xs text-muted-foreground">
              Used to sign webhook payloads with HMAC-SHA256
            </p>
          </div>

          <div className="space-y-2">
            <Label>Events</Label>
            <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-4">
              {groupedEvents &&
                Object.entries(groupedEvents).map(([resource, events]) => (
                  <div key={resource}>
                    <h4 className="font-medium capitalize mb-2">{resource}</h4>
                    <div className="space-y-2">
                      {events.map((event) => (
                        <label
                          key={event.event}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedEvents.includes(event.event)}
                            onCheckedChange={() => onToggleEvent(event.event)}
                          />
                          <span className="text-sm">{event.action}</span>
                          <span className="text-xs text-muted-foreground">
                            - {event.description}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedEvents.length} event(s) selected
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!name || !url || selectedEvents.length === 0 || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
