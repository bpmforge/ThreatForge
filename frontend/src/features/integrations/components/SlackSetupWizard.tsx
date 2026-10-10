"use client";

import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import {
  MessageSquare,
  Loader2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
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

interface SlackSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function SlackSetupWizard({
  open,
  onOpenChange,
  onComplete,
}: SlackSetupWizardProps) {
  const [step, setStep] = useState<"config" | "success">("config");
  const [botToken, setBotToken] = useState("");
  const [defaultChannel, setDefaultChannel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken.trim()) {
      toast.error("Bot token is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost("/api/notifications/integrations/slack", {
        botToken,
        defaultChannel: defaultChannel || undefined,
      });

      setStep("success");
      toast.success("Slack integration configured");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to configure Slack"));
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
    setBotToken("");
    setDefaultChannel("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#4A154B]" />
            Connect Slack
          </DialogTitle>
          <DialogDescription>
            Send threat model notifications to Slack channels
          </DialogDescription>
        </DialogHeader>

        {step === "config" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botToken">Bot Token</Label>
              <Input
                id="botToken"
                type="password"
                placeholder="xoxb-..."
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Create a Slack app and get the Bot User OAuth Token.{" "}
                <a
                  href="https://api.slack.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Create Slack App <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultChannel">Default Channel (optional)</Label>
              <Input
                id="defaultChannel"
                placeholder="#security-alerts"
                value={defaultChannel}
                onChange={(e) => setDefaultChannel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Channel for notifications if not specified per-event
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
                Connect Slack
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="py-6 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2">Slack Connected!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You&apos;ll receive notifications for threat model events in your
              Slack workspace.
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
