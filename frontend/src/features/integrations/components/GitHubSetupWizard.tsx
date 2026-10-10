"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Github } from "lucide-react";
import { GitHubStep1 } from "./steps/GitHubStep1";
import { GitHubStep2 } from "./steps/GitHubStep2";
import { GitHubStep3 } from "./steps/GitHubStep3";
import { GitHubStep4 } from "./steps/GitHubStep4";
import { useGitHubSetupWizard } from "./useGitHubSetupWizard";
import { GitHubWizardStepIndicator } from "./GitHubWizardStepIndicator";

interface GitHubSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onComplete: () => void;
}

export function GitHubSetupWizard({
  open,
  onOpenChange,
  organizationId,
  onComplete,
}: GitHubSetupWizardProps) {
  const h = useGitHubSetupWizard({ organizationId, onComplete, onOpenChange });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) h.resetWizard();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Connect GitHub Issues
          </DialogTitle>
          <DialogDescription>
            {h.step === "credentials" &&
              "Enter your GitHub Personal Access Token to get started."}
            {h.step === "repository" &&
              "Select the repository to sync issues with."}
            {h.step === "labels" && "Configure labels and sync options."}
            {h.step === "confirm" && "Review your settings before connecting."}
          </DialogDescription>
        </DialogHeader>

        <GitHubWizardStepIndicator
          step={h.step}
          tokenValid={h.tokenValid}
          selectedRepo={h.selectedRepo}
        />

        {h.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{h.error}</AlertDescription>
          </Alert>
        )}

        <div className="py-4">
          {h.step === "credentials" && (
            <GitHubStep1
              token={h.token}
              onTokenChange={h.setToken}
              loading={h.loading}
              onValidateToken={h.validateToken}
            />
          )}
          {h.step === "repository" && (
            <GitHubStep2
              repositories={h.repositories}
              selectedRepo={h.selectedRepo}
              onSelectRepository={h.selectRepository}
            />
          )}
          {h.step === "labels" && h.selectedRepo && (
            <GitHubStep3
              labels={h.labels}
              threatLabel={h.threatLabel}
              onThreatLabelChange={h.setThreatLabel}
              mitigationLabel={h.mitigationLabel}
              onMitigationLabelChange={h.setMitigationLabel}
              syncDirection={h.syncDirection}
              onSyncDirectionChange={h.setSyncDirection}
              autoCreateIssues={h.autoCreateIssues}
              onAutoCreateIssuesChange={h.setAutoCreateIssues}
            />
          )}
          {h.step === "confirm" && h.selectedRepo && (
            <GitHubStep4
              selectedRepo={h.selectedRepo}
              threatLabel={h.threatLabel}
              mitigationLabel={h.mitigationLabel}
              syncDirection={h.syncDirection}
              autoCreateIssues={h.autoCreateIssues}
            />
          )}
        </div>

        <DialogFooter>
          {h.step !== "credentials" && (
            <Button variant="outline" onClick={h.goBack} disabled={h.loading}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={h.loading}
          >
            Cancel
          </Button>
          {h.step === "labels" && (
            <Button onClick={() => h.setStep("confirm")}>Continue</Button>
          )}
          {h.step === "confirm" && (
            <Button onClick={h.saveIntegration} disabled={h.loading}>
              {h.loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect GitHub"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
