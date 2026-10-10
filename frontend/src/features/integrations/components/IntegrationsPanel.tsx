"use client";

/**
 * Integrations Panel
 *
 * Main panel for managing organization integrations
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
import { Plus, Plug } from "lucide-react";
import { useIntegrations, useIntegrationTypes } from "../hooks/useIntegrations";
import { IntegrationCard } from "./IntegrationCard";
import { JiraSetupWizard } from "./JiraSetupWizard";
import { UnverifiedBadge } from "./UnverifiedBadge";
import { GitHubSetupWizard } from "./GitHubSetupWizard";
import { SlackSetupWizard } from "./SlackSetupWizard";
import { TeamsSetupWizard } from "./TeamsSetupWizard";
import type { IntegrationType } from "../types";

const INTEGRATION_INFO: Record<
  IntegrationType,
  { name: string; description: string; icon: string; comingSoon?: boolean }
> = {
  JIRA: {
    name: "Jira",
    description: "Create and sync issues with Jira Cloud",
    icon: "🎫",
  },
  GITHUB_ISSUES: {
    name: "GitHub Issues",
    description: "Track threats and mitigations as GitHub issues",
    icon: "🐙",
  },
  AZURE_DEVOPS: {
    name: "Azure DevOps",
    description: "Sync with Azure DevOps work items",
    icon: "🔷",
    comingSoon: true,
  },
  LINEAR: {
    name: "Linear",
    description: "Create Linear issues from threats",
    icon: "📊",
    comingSoon: true,
  },
  ASANA: {
    name: "Asana",
    description: "Track mitigations as Asana tasks",
    icon: "📋",
    comingSoon: true,
  },
  SLACK: {
    name: "Slack",
    description: "Get notifications in Slack channels",
    icon: "💬",
  },
  TEAMS: {
    name: "Microsoft Teams",
    description: "Send alerts to Teams channels",
    icon: "👥",
  },
  CUSTOM_WEBHOOK: {
    name: "Custom Webhook",
    description: "Send events to your own endpoints",
    icon: "🔗",
    comingSoon: true,
  },
};

interface IntegrationsPanelProps {
  orgId: string;
}

export function IntegrationsPanel({ orgId }: IntegrationsPanelProps) {
  const { data: integrations, isLoading: loadingIntegrations } =
    useIntegrations(orgId);
  const { data: types, isLoading: loadingTypes } = useIntegrationTypes(orgId);

  const [jiraWizardOpen, setJiraWizardOpen] = useState(false);
  const [githubWizardOpen, setGithubWizardOpen] = useState(false);
  const [slackWizardOpen, setSlackWizardOpen] = useState(false);
  const [teamsWizardOpen, setTeamsWizardOpen] = useState(false);

  const handleAddIntegration = (type: IntegrationType) => {
    if (type === "JIRA") {
      setJiraWizardOpen(true);
    } else if (type === "GITHUB_ISSUES") {
      setGithubWizardOpen(true);
    } else if (type === "SLACK") {
      setSlackWizardOpen(true);
    } else if (type === "TEAMS") {
      setTeamsWizardOpen(true);
    }
  };

  const configuredTypes = new Set(integrations?.map((i) => i.type) || []);

  if (loadingIntegrations || loadingTypes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Integrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading integrations...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Active Integrations */}
        {integrations && integrations.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Active Integrations</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {integrations.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  orgId={orgId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Available Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" />
              Available Integrations
            </CardTitle>
            <CardDescription>
              Connect your threat models with external tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(INTEGRATION_INFO) as IntegrationType[]).map(
                (type) => {
                  const info = INTEGRATION_INFO[type];
                  const isConfigured = configuredTypes.has(type);
                  const _typeInfo = types?.find((t) => t.type === type);

                  return (
                    <div
                      key={type}
                      className={`p-4 rounded-lg border transition-colors ${
                        info.comingSoon
                          ? "opacity-60 cursor-not-allowed"
                          : isConfigured
                            ? "bg-accent/50"
                            : "hover:bg-accent/30 cursor-pointer"
                      }`}
                      onClick={() =>
                        !info.comingSoon &&
                        !isConfigured &&
                        handleAddIntegration(type)
                      }
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{info.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{info.name}</span>
                            {info.comingSoon && (
                              <Badge variant="secondary" className="text-xs">
                                Coming Soon
                              </Badge>
                            )}
                            {isConfigured && (
                              <Badge variant="default" className="text-xs">
                                Configured
                              </Badge>
                            )}
                            <UnverifiedBadge type={type} />
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {info.description}
                          </p>
                        </div>
                        {!info.comingSoon && !isConfigured && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </CardContent>
        </Card>

        {/* Empty state */}
        {(!integrations || integrations.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Plug className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No integrations configured</p>
                <p className="text-sm mt-1">
                  Connect your threat models with external tools to streamline
                  your workflow
                </p>
                <Button
                  className="mt-4"
                  onClick={() => handleAddIntegration("JIRA")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add JIRA Integration
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <JiraSetupWizard
        open={jiraWizardOpen}
        onOpenChange={setJiraWizardOpen}
        orgId={orgId}
      />

      <GitHubSetupWizard
        open={githubWizardOpen}
        onOpenChange={setGithubWizardOpen}
        organizationId={orgId}
        onComplete={() => {
          window.location.reload();
        }}
      />

      <SlackSetupWizard
        open={slackWizardOpen}
        onOpenChange={setSlackWizardOpen}
        onComplete={() => {
          window.location.reload();
        }}
      />

      <TeamsSetupWizard
        open={teamsWizardOpen}
        onOpenChange={setTeamsWizardOpen}
        onComplete={() => {
          window.location.reload();
        }}
      />
    </>
  );
}
