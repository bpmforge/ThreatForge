"use client";

import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { Users, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";

interface TeamsSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function TeamsSetupWizard({
  open,
  onOpenChange,
  onComplete,
}: TeamsSetupWizardProps) {
  const [step, setStep] = useState<"config" | "success">("config");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) {
      toast.error("Webhook URL is required");
      return;
    }

    if (!webhookUrl.includes("webhook.office.com")) {
      toast.error("Please enter a valid Teams webhook URL");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost("/api/notifications/integrations/teams", { webhookUrl });

      setStep("success");
      toast.success("Teams integration configured");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to configure Teams"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (step === "success") {
      onComplete?.();
    }
    onOpenChange(false);
    setStep("config");
    setWebhookUrl("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#6264A7]" />
            Connect Microsoft Teams
          </DialogTitle>
          <DialogDescription>
            Send threat model notifications to Teams channels
          </DialogDescription>
        </DialogHeader>

        {step === "config" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Incoming Webhook URL</Label>
              <Input
                id="webhookUrl"
                type="url"
                placeholder="https://...webhook.office.com/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Create an incoming webhook in your Teams channel.{" "}
                <a
                  href="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Learn how <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Connect Teams
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="py-6 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2">Teams Connected!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You&apos;ll receive notifications for threat model events in your
              Teams channel.
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
