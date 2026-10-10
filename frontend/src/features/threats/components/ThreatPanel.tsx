"use client";

/**
 * ThreatPanel - Main threat management panel (thin container).
 *
 * Composes ThreatPanelHeader, ThreatPanelFilters, ThreatPanelList, and ThreatPanelFooter.
 * Business logic delegated to useJiraIntegration and useThreatFilters hooks.
 */
import { useThreatPanel } from "../hooks/useThreatPanel";
import { ThreatPanelHeader } from "./ThreatPanelHeader";
import { ThreatPanelFilters } from "./ThreatPanelFilters";
import { ThreatPanelList } from "./ThreatPanelList";
import { ThreatPanelFooter } from "./ThreatPanelFooter";
import { ThreatViewTabs } from "./ThreatViewTabs";
import { ThreatRemediationView } from "./ThreatRemediationView";
import { ThreatPanelDialogs } from "./ThreatPanelDialogs";
import { NextActionSuggestion } from "./NextActionSuggestion";

interface ThreatPanelProps {
  modelId: string | null;
}

export function ThreatPanel({ modelId }: ThreatPanelProps) {
  const p = useThreatPanel(modelId);

  return (
    <div className="w-full h-full bg-background flex flex-col min-h-0">
      <ThreatPanelHeader
        modelId={modelId}
        selectedLabel={p.contextLabel}
        selectedComponentType={
          p.isAddingGeneralThreat ? undefined : p.selectedComponentType
        }
        showAddDialog={p.showAddDialog}
        showLibraryDialog={p.showLibraryDialog}
        existingCategories={p.filters.uniqueCategories}
        pendingSuggestionsCount={p.pendingSuggestionsCount}
        onShowAddDialogChange={p.setShowAddDialog}
        onShowLibraryDialogChange={p.setShowLibraryDialog}
        onAddThreat={p.handleAddThreat}
        onLibrarySelect={p.handleLibrarySelect}
      />

      {modelId && (
        <ThreatViewTabs
          view={p.view}
          threatsCount={p.threats.length}
          onViewChange={p.setView}
        />
      )}

      {modelId && p.view === "threats" && (
        <ThreatPanelFilters
          filter={p.filters.filter}
          onFilterChange={p.filters.setFilter}
          totalCount={p.threats.length}
          generalCount={p.filters.generalThreatsCount}
          componentCount={p.filters.componentThreatsCount}
          categoryFilter={p.filters.categoryFilter}
          onCategoryFilterChange={p.filters.setCategoryFilter}
          uniqueCategories={p.filters.uniqueCategories}
          categoryCountMap={p.filters.categoryCountMap}
          groupByCategory={p.filters.groupByCategory}
          onGroupByCategoryChange={p.filters.setGroupByCategory}
          sinceLastSignOff={p.sinceLastSignOff}
          onSinceLastSignOffChange={p.setSinceLastSignOff}
        />
      )}

      {p.view === "remediation" && p.threats.length > 0 && (
        <ThreatRemediationView
          threats={p.threats}
          onStatusChange={(id, status) =>
            p.updateThreatStatus.mutate({ threatId: id, status })
          }
        />
      )}

      {p.view === "threats" && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ThreatPanelList
            modelId={modelId}
            isLoading={p.isLoading}
            filteredThreats={p.filters.filteredThreats}
            groupedThreats={p.filters.groupedThreats}
            groupByCategory={p.filters.groupByCategory}
            expandedThreatId={p.expandedThreatId}
            onExpandedThreatChange={p.setExpandedThreatId}
            getConnectionData={p.getConnectionData}
            onStatusChange={(id, status) =>
              p.updateThreatStatus.mutate({ threatId: id, status })
            }
            onDelete={(id) => p.deleteThreat.mutate(id)}
            onEdit={p.setEditThreat}
            onAddMitigation={p.setMitigationThreatId}
            onMitigationStatusChange={(tid, mid, status) =>
              p.updateMitigationStatusMutation.mutate({
                threatId: tid,
                mitigationId: mid,
                status,
              })
            }
            onDeleteMitigation={(tid, mid) =>
              p.deleteMitigation.mutate({ threatId: tid, mitigationId: mid })
            }
            onEditMitigation={p.openEditMitigation}
            onSaveAsTemplate={p.setTemplateThreat}
            onShowAddDialog={() => p.setShowAddDialog(true)}
            onShowLibraryDialog={() => p.setShowLibraryDialog(true)}
            hasJiraIntegration={p.jira.hasJiraIntegration}
            getJiraIssueUrl={p.jira.getJiraIssueUrl}
            onCreateJiraIssue={p.jira.handleCreateJiraIssue}
            isCreatingJiraIssue={p.jira.isCreatingJiraIssue}
            getMitigationJiraUrls={p.jira.getMitigationJiraUrls}
            onCreateMitigationJiraIssue={
              p.jira.handleCreateJiraIssueForMitigation
            }
            creatingJiraForMitigationId={p.jira.creatingJiraForMitigationId}
            onMoveMitigation={(tid, mid) =>
              p.setMovingMitigation({ threatId: tid, mitigationId: mid })
            }
            onRefineWithAI={(tid) => {
              const t = p.threats.find((x) => x.id === tid);
              if (t) p.setRefineThreat(t);
            }}
          />
          {p.threats.length > 0 && !p.isLoading && (
            <div className="p-3 border-t shrink-0">
              <NextActionSuggestion
                context={
                  p.threats.every(
                    (t) => t.mitigations && t.mitigations.length > 0,
                  )
                    ? "threats_mitigated"
                    : "threats_generated"
                }
                onAddMitigations={() =>
                  p.setMitigationThreatId(p.threats[0]?.id ?? null)
                }
                onRunCompliance={() => p.setActiveRightPanel("compliance")}
                onRequestReview={() => p.setActiveRightPanel("review")}
                onExportReport={() => p.setActiveRightPanel("score")}
              />
            </div>
          )}
        </div>
      )}

      <ThreatPanelDialogs
        modelId={modelId}
        orgId={p.orgId}
        threats={p.threats}
        mitigationThreatId={p.mitigationThreatId}
        movingMitigation={p.movingMitigation}
        editThreat={p.editThreat}
        editMitigation={p.editMitigation}
        templateThreat={p.templateThreat}
        refineThreat={p.refineThreat}
        uniqueCategories={p.filters.uniqueCategories}
        onMitigationThreatIdChange={p.setMitigationThreatId}
        onMovingMitigationChange={p.setMovingMitigation}
        onEditThreatChange={p.setEditThreat}
        onEditMitigationChange={p.setEditMitigation}
        onTemplateThreatChange={p.setTemplateThreat}
        onRefineThreatChange={p.setRefineThreat}
        onAddMitigation={p.handleAddMitigation}
        onEditThreat={p.handleEditThreat}
        onEditMitigation={p.handleEditMitigation}
        onApplyRefinement={p.handleApplyRefinement}
        onResetThreatToAi={(id) => p.resetThreatToAi.mutate(id)}
      />

      {modelId && <ThreatPanelFooter threats={p.threats} />}
    </div>
  );
}
