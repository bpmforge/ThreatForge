/**
 * useJiraIntegration - Custom hook for JIRA integration in ThreatPanel
 *
 * Extracts JIRA-related state and callbacks from ThreatPanel for better separation.
 */
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  useIntegrations,
  useCreateJiraIssue,
  useIntegrationMappings,
} from "@/features/integrations";
import type { Threat } from "../types";

interface UseJiraIntegrationOptions {
  orgId: string | null;
  threats: Threat[];
}

export function useJiraIntegration({
  orgId,
  threats,
}: UseJiraIntegrationOptions) {
  // JIRA integration hooks
  const { data: integrations } = useIntegrations(orgId);
  const jiraIntegration = useMemo(
    () => integrations?.find((i) => i.type === "JIRA" && i.status === "ACTIVE"),
    [integrations],
  );
  const createJiraIssueMutation = useCreateJiraIssue(
    orgId || "",
    jiraIntegration?.id || "",
  );
  const { data: jiraMappings } = useIntegrationMappings(
    orgId,
    jiraIntegration?.id || null,
  );

  // Track which mitigation is being synced to JIRA
  const [creatingJiraForMitigationId, setCreatingJiraForMitigationId] =
    useState<string | null>(null);

  // Get JIRA issue URL for a threat
  const getJiraIssueUrl = useCallback(
    (threatId: string): string | null => {
      const mapping = jiraMappings?.find(
        (m) => m.localType === "threat" && m.localId === threatId,
      );
      return mapping?.externalUrl || null;
    },
    [jiraMappings],
  );

  // Get JIRA issue URLs for mitigations of a threat
  const getMitigationJiraUrls = useCallback(
    (threatId: string): Record<string, string> => {
      const result: Record<string, string> = {};
      const threat = threats.find((t) => t.id === threatId);
      if (!threat) return result;

      threat.mitigations.forEach((m) => {
        const mapping = jiraMappings?.find(
          (jm) => jm.localType === "mitigation" && jm.localId === m.id,
        );
        if (mapping?.externalUrl) {
          result[m.id] = mapping.externalUrl;
        }
      });
      return result;
    },
    [jiraMappings, threats],
  );

  // Handle JIRA issue creation for threat
  const handleCreateJiraIssue = useCallback(
    async (threatId: string) => {
      if (!orgId || !jiraIntegration) return;
      try {
        const result = await createJiraIssueMutation.mutateAsync({ threatId });
        toast.success("JIRA issue created", {
          description: `Issue ${result.issueKey} created`,
          action: {
            label: "View",
            onClick: () => window.open(result.issueUrl, "_blank"),
          },
        });
      } catch {
        toast.error("Failed to create JIRA issue");
      }
    },
    [orgId, jiraIntegration, createJiraIssueMutation],
  );

  // Handle JIRA issue creation for mitigation
  const handleCreateJiraIssueForMitigation = useCallback(
    async (threatId: string, mitigationId: string) => {
      if (!orgId || !jiraIntegration) return;
      setCreatingJiraForMitigationId(mitigationId);
      try {
        const result = await createJiraIssueMutation.mutateAsync({
          mitigationId,
        });
        toast.success("JIRA issue created", {
          description: `Issue ${result.issueKey} created`,
          action: {
            label: "View",
            onClick: () => window.open(result.issueUrl, "_blank"),
          },
        });
      } catch {
        toast.error("Failed to create JIRA issue");
      } finally {
        setCreatingJiraForMitigationId(null);
      }
    },
    [orgId, jiraIntegration, createJiraIssueMutation],
  );

  return {
    hasJiraIntegration: !!jiraIntegration,
    isCreatingJiraIssue: createJiraIssueMutation.isPending,
    creatingJiraForMitigationId,
    getJiraIssueUrl,
    getMitigationJiraUrls,
    handleCreateJiraIssue,
    handleCreateJiraIssueForMitigation,
  };
}
