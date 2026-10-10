"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import type { Threat } from "../types";
import type { ConnectionData } from "@/types/canvas";
import { STATUS_OPTIONS } from "../constants";
import { MitigationList } from "./MitigationList";
import { CommentsThread } from "./CommentsThread";
import { DerivedSecurityControls } from "./DerivedSecurityControls";
import { CitationPanel } from "./CitationPanel";
import { ThreatBadgeRow } from "./ThreatBadgeRow";
import { ThreatCardMenu } from "./ThreatCardMenu";
import { ThreatReferencePills } from "./ThreatReferencePills";

interface ThreatCardProps {
  modelId: string | null;
  threat: Threat;
  isExpanded: boolean;
  connectionData?: ConnectionData;
  onToggleExpand: (expanded: boolean) => void;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
  onEdit: () => void;
  onAddMitigation: () => void;
  onMitigationStatusChange: (mitigationId: string, status: string) => void;
  onDeleteMitigation: (mitigationId: string) => void;
  onEditMitigation: (mitigationId: string) => void;
  onGenerateAttackTree?: () => void;
  onSaveAsTemplate?: () => void;
  onCreateJiraIssue?: () => void;
  isCreatingJiraIssue?: boolean;
  hasJiraIntegration?: boolean;
  jiraIssueUrl?: string | null;
  mitigationJiraUrls?: Record<string, string>;
  onCreateMitigationJiraIssue?: (mitigationId: string) => void;
  creatingJiraForMitigationId?: string | null;
  onCalculateSeverity?: () => void;
  onRefineWithAI?: () => void;
  onMoveMitigation?: (mitigationId: string) => void;
}

export function ThreatCard({
  modelId,
  threat,
  isExpanded,
  connectionData,
  onToggleExpand,
  onStatusChange,
  onDelete,
  onEdit,
  onAddMitigation,
  onMitigationStatusChange,
  onDeleteMitigation,
  onEditMitigation,
  onSaveAsTemplate,
  onCreateJiraIssue,
  isCreatingJiraIssue,
  hasJiraIntegration,
  jiraIssueUrl,
  mitigationJiraUrls,
  onCreateMitigationJiraIssue,
  creatingJiraForMitigationId,
  onCalculateSeverity,
  onGenerateAttackTree,
  onRefineWithAI,
  onMoveMitigation,
}: ThreatCardProps) {
  const [citationPanelOpen, setCitationPanelOpen] = useState(false);

  const completedMitigations = threat.mitigations.filter(
    (m) => m.status === "COMPLETED" || m.status === "VERIFIED",
  ).length;

  const accessibleLabel = `${threat.name}. STRIDE categories: ${threat.strideCategories.join(", ")}. Severity: ${threat.severity}. Status: ${threat.status}. ${completedMitigations} of ${threat.mitigations.length} mitigations complete.`;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <article
        className="rounded-lg border transition-colors"
        aria-label={accessibleLabel}
        role="article"
      >
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <ThreatBadgeRow
              threat={threat}
              modelId={modelId}
              completedMitigations={completedMitigations}
              citationPanelOpen={citationPanelOpen}
              onCitationPanelChange={setCitationPanelOpen}
            />
            <ThreatCardMenu
              threatName={threat.name}
              hasJiraIntegration={hasJiraIntegration}
              jiraIssueUrl={jiraIssueUrl}
              isCreatingJiraIssue={isCreatingJiraIssue}
              onEdit={onEdit}
              onDelete={onDelete}
              onCalculateSeverity={onCalculateSeverity}
              onRefineWithAI={onRefineWithAI}
              onGenerateAttackTree={onGenerateAttackTree}
              onSaveAsTemplate={onSaveAsTemplate}
              onCreateJiraIssue={onCreateJiraIssue}
            />
          </div>

          <button
            onClick={onEdit}
            aria-label={`Edit threat: ${threat.name}`}
            className="text-left w-full group cursor-pointer hover:bg-muted/50 rounded -mx-1 px-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            <h4 className="font-medium text-foreground mt-2 group-hover:text-primary transition-colors">
              {threat.name}
            </h4>
            {threat.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {threat.description}
              </p>
            )}
          </button>

          {threat.connectionEdgeId && connectionData && (
            <DerivedSecurityControls connectionData={connectionData} />
          )}

          <Separator className="my-2" />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Status:</Label>
              <Select value={threat.status} onValueChange={onStatusChange}>
                <SelectTrigger className="h-7 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} mitigations. ${threat.mitigations.length} mitigation${threat.mitigations.length !== 1 ? "s" : ""}`}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                <span className="ml-1 text-xs">
                  {threat.mitigations.length} mitigation
                  {threat.mitigations.length !== 1 ? "s" : ""}
                </span>
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {modelId && (
          <CitationPanel
            modelId={modelId}
            threatId={threat.id}
            open={citationPanelOpen}
            onOpenChange={setCitationPanelOpen}
          />
        )}

        <CollapsibleContent>
          <ThreatReferencePills
            cweIds={threat.cweIds}
            owaspIds={threat.owaspIds}
          />
          <MitigationList
            mitigations={threat.mitigations}
            onAdd={onAddMitigation}
            onStatusChange={onMitigationStatusChange}
            onDelete={onDeleteMitigation}
            onEdit={onEditMitigation}
            hasJiraIntegration={hasJiraIntegration}
            onCreateJiraIssue={onCreateMitigationJiraIssue}
            creatingJiraIssueFor={creatingJiraForMitigationId}
            jiraIssueUrls={mitigationJiraUrls}
            onMove={onMoveMitigation}
          />
          {modelId && <CommentsThread modelId={modelId} threatId={threat.id} />}
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}
