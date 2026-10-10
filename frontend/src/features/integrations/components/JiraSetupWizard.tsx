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
import { UNVERIFIED_INTEGRATIONS } from "./UnverifiedBadge";
import { Loader2, AlertCircle } from "lucide-react";
import { useJiraWizard } from "../hooks/useJiraWizard";
import { JiraStep1 } from "./steps/JiraStep1";
import { JiraStep2 } from "./steps/JiraStep2";
import { JiraStep3 } from "./steps/JiraStep3";
import { JiraStep4 } from "./steps/JiraStep4";

interface JiraSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
}

export function JiraSetupWizard({
  open,
  onOpenChange,
  orgId,
}: JiraSetupWizardProps) {
  const w = useJiraWizard(orgId, () => onOpenChange(false));

  const stepDescriptions: Record<string, string> = {
    credentials: "Enter your JIRA credentials to connect",
    project: "Select the JIRA project to sync with",
    mapping: "Configure issue type mappings",
    confirm: "Review and confirm your settings",
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) w.resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure JIRA Integration</DialogTitle>
          <DialogDescription>{stepDescriptions[w.step]}</DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertDescription>{UNVERIFIED_INTEGRATIONS.JIRA}</AlertDescription>
        </Alert>

        <div className="py-4 space-y-4">
          {w.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{w.error}</AlertDescription>
            </Alert>
          )}

          {w.step === "credentials" && (
            <JiraStep1
              name={w.name}
              onNameChange={w.setName}
              baseUrl={w.baseUrl}
              onBaseUrlChange={w.setBaseUrl}
              email={w.email}
              onEmailChange={w.setEmail}
              apiToken={w.apiToken}
              onApiTokenChange={w.setApiToken}
              connectionVerified={w.connectionVerified}
              projectCount={w.projects.length}
              isPending={w.isPending}
              isTestPending={w.testConnection.isPending}
              onTestConnection={w.handleTestConnection}
            />
          )}

          {w.step === "project" && (
            <JiraStep2
              projects={w.projects}
              selectedProject={w.selectedProject}
              onProjectSelect={w.handleProjectSelect}
              issueTypeCount={w.issueTypes.length}
              isFetchingIssueTypes={w.isPending}
            />
          )}

          {w.step === "mapping" && (
            <JiraStep3
              issueTypes={w.issueTypes}
              threatIssueType={w.threatIssueType}
              onThreatIssueTypeChange={w.setThreatIssueType}
              mitigationIssueType={w.mitigationIssueType}
              onMitigationIssueTypeChange={w.setMitigationIssueType}
              syncDirection={w.syncDirection}
              onSyncDirectionChange={w.setSyncDirection}
              autoCreate={w.autoCreate}
              onAutoCreateChange={w.setAutoCreate}
            />
          )}

          {w.step === "confirm" && (
            <JiraStep4
              name={w.name}
              baseUrl={w.baseUrl}
              selectedProject={w.selectedProject}
              projects={w.projects}
              issueTypes={w.issueTypes}
              threatIssueType={w.threatIssueType}
              mitigationIssueType={w.mitigationIssueType}
              autoCreate={w.autoCreate}
              syncDirection={w.syncDirection}
            />
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {w.step !== "credentials" && (
            <Button
              variant="outline"
              onClick={w.prevStep}
              disabled={w.isPending}
            >
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={w.isPending}
          >
            Cancel
          </Button>
          {w.step === "confirm" ? (
            <Button onClick={w.handleCreate} disabled={w.isPending}>
              {w.createIntegration.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Integration"
              )}
            </Button>
          ) : (
            <Button
              onClick={w.nextStep}
              disabled={!w.canProceed() || w.isPending}
            >
              Next
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
