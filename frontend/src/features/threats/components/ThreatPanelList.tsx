"use client";

/**
 * ThreatPanelList - Renders flat or grouped threat card lists.
 */
// Native scroll used instead of Radix ScrollArea — flex height constraints
// don't reliably propagate to ScrollArea's internal viewport.
import { useQueryClient } from "@tanstack/react-query";
import { ThreatCard } from "./ThreatCard";
import { EmptyThreatList } from "@/components/empty-states";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import { updateThreat } from "../services/api";
import { THREAT_QUERY_KEYS } from "../hooks/useThreats";
import type { Threat } from "../types";
import type { ConnectionData } from "@/types/canvas";
import type { Severity } from "@/types/canvas";

interface ThreatGroup {
  category: string;
  threats: Threat[];
}

interface ThreatPanelListProps {
  modelId: string | null;
  isLoading: boolean;
  filteredThreats: Threat[];
  groupedThreats: ThreatGroup[] | null;
  groupByCategory: boolean;
  expandedThreatId: string | null;
  onExpandedThreatChange: (id: string | null) => void;
  getConnectionData: (edgeId: string | undefined) => ConnectionData | undefined;
  onStatusChange: (threatId: string, status: string) => void;
  onDelete: (threatId: string) => void;
  onEdit: (threat: Threat) => void;
  onAddMitigation: (threatId: string) => void;
  onMitigationStatusChange: (
    threatId: string,
    mitigationId: string,
    status: string,
  ) => void;
  onDeleteMitigation: (threatId: string, mitigationId: string) => void;
  onEditMitigation: (threatId: string, mitigationId: string) => void;
  onSaveAsTemplate: (threat: Threat) => void;
  onShowAddDialog: () => void;
  onShowLibraryDialog: () => void;
  /** JIRA integration props */
  hasJiraIntegration: boolean;
  getJiraIssueUrl: (threatId: string) => string | null;
  onCreateJiraIssue: (threatId: string) => void;
  isCreatingJiraIssue: boolean;
  getMitigationJiraUrls: (threatId: string) => Record<string, string>;
  onCreateMitigationJiraIssue: (threatId: string, mitigationId: string) => void;
  creatingJiraForMitigationId: string | null;
  /** Optional: called when a mitigation's Move button is clicked */
  onMoveMitigation?: (threatId: string, mitigationId: string) => void;
  /** Optional: open AI refinement sheet for a threat */
  onRefineWithAI?: (threatId: string) => void;
}

export function ThreatPanelList({
  modelId,
  isLoading,
  filteredThreats,
  groupedThreats,
  groupByCategory,
  expandedThreatId,
  onExpandedThreatChange,
  getConnectionData,
  onStatusChange,
  onDelete,
  onEdit,
  onAddMitigation,
  onMitigationStatusChange,
  onDeleteMitigation,
  onEditMitigation,
  onSaveAsTemplate,
  onShowAddDialog,
  onShowLibraryDialog,
  hasJiraIntegration,
  getJiraIssueUrl,
  onCreateJiraIssue,
  isCreatingJiraIssue,
  getMitigationJiraUrls,
  onCreateMitigationJiraIssue,
  creatingJiraForMitigationId,
  onMoveMitigation,
  onRefineWithAI,
}: ThreatPanelListProps) {
  const queryClient = useQueryClient();

  const renderThreatCard = (threat: Threat) => (
    <ThreatCard
      key={threat.id}
      modelId={modelId}
      threat={threat}
      isExpanded={expandedThreatId === threat.id}
      connectionData={getConnectionData(threat.connectionEdgeId)}
      onToggleExpand={(expanded) =>
        onExpandedThreatChange(expanded ? threat.id : null)
      }
      onStatusChange={(status) => onStatusChange(threat.id, status)}
      onDelete={() => onDelete(threat.id)}
      onEdit={() => onEdit(threat)}
      onAddMitigation={() => onAddMitigation(threat.id)}
      onMitigationStatusChange={(mid, status) =>
        onMitigationStatusChange(threat.id, mid, status)
      }
      onDeleteMitigation={(mid) => onDeleteMitigation(threat.id, mid)}
      onEditMitigation={(mid) => onEditMitigation(threat.id, mid)}
      onMoveMitigation={
        onMoveMitigation ? (mid) => onMoveMitigation(threat.id, mid) : undefined
      }
      onRefineWithAI={
        onRefineWithAI ? () => onRefineWithAI(threat.id) : undefined
      }
      onSaveAsTemplate={() => onSaveAsTemplate(threat)}
      hasJiraIntegration={hasJiraIntegration}
      jiraIssueUrl={getJiraIssueUrl(threat.id)}
      onCreateJiraIssue={() => onCreateJiraIssue(threat.id)}
      isCreatingJiraIssue={isCreatingJiraIssue}
      mitigationJiraUrls={getMitigationJiraUrls(threat.id)}
      onCreateMitigationJiraIssue={(mid) =>
        onCreateMitigationJiraIssue(threat.id, mid)
      }
      creatingJiraForMitigationId={creatingJiraForMitigationId}
      onCalculateSeverity={async () => {
        if (!modelId) return;
        try {
          toast.info("Calculating severity...");
          const result = await apiPost<{
            severity: string;
            reasoning?: string;
          }>(`/api/threat-models/${modelId}/ai/severity-calculate`, {
            threat: {
              title: threat.name,
              description: threat.description || threat.name,
              category: threat.strideCategories[0] || "TAMPERING",
            },
          });
          const aiSeverity = (
            result.severity as string
          )?.toUpperCase() as Severity;

          // Apply AI result: save severity to DB + recalculate CVSS
          await updateThreat(modelId, threat.id, { severity: aiSeverity });
          await apiPost(`/api/threat-models/${modelId}/ai/rescore`, {
            threatIds: [threat.id],
          }).catch(() => {});
          await queryClient.invalidateQueries({
            queryKey: THREAT_QUERY_KEYS.threats(modelId),
          });

          toast.success(
            `Severity updated to ${aiSeverity}${result.reasoning ? ` — ${result.reasoning.slice(0, 120)}` : ""}`,
            { duration: 8000 },
          );
        } catch {
          toast.error("Could not calculate severity. Check AI configuration.");
        }
      }}
      onGenerateAttackTree={async () => {
        try {
          toast.info("Generating attack tree...");
          const result = await apiPost<{
            attackTree?: { goal?: string; children?: unknown[] };
          }>(`/api/threat-models/${modelId}/ai/attack-tree`, {
            threatName: threat.name,
            threatDescription: threat.description,
            strideCategory: threat.strideCategories[0],
          });
          const tree = result.attackTree;
          const branches = (tree?.children || []).length;
          const leafCount =
            JSON.stringify(tree).split('"mitigation"').length - 1;
          toast.success(
            `Attack Tree: "${tree?.goal || threat.name}"\n${branches} attack paths, ${leafCount} leaf attacks identified`,
            { duration: 10000 },
          );
        } catch {
          toast.error(
            "Could not generate attack tree. Check AI configuration.",
          );
        }
      }}
    />
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-4">
        {!modelId ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Save your threat model first to add threats
          </p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Loading...
          </p>
        ) : filteredThreats.length === 0 ? (
          <EmptyThreatList
            onAddThreat={onShowAddDialog}
            onSuggestThreats={onShowLibraryDialog}
          />
        ) : groupByCategory && groupedThreats ? (
          <div className="space-y-4">
            {groupedThreats.map((group) => (
              <div key={group.category}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                    {group.category}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({group.threats.length})
                  </span>
                </div>
                <div className="space-y-3 pl-2 border-l-2 border-purple-200">
                  {group.threats.map(renderThreatCard)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredThreats.map(renderThreatCard)}
          </div>
        )}
      </div>
    </div>
  );
}
