/**
 * Model Canvas Page
 *
 * Displays the threat modeling canvas for a specific model.
 * Supports both architecture diagrams and sequence diagrams via tabs.
 * Responsive: Uses drawer panels on mobile/tablet devices.
 */
"use client";

import { useParams, useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ThreatModelCanvasProvider } from "@/components/canvas";
import { ComponentPalette } from "@/components/panels/ComponentPalette";
import { Toolbar } from "@/features/toolbar";
import { DiagramTabs, SequenceCanvas } from "@/features/sequence-diagrams";
import { DFDCanvasWrapper } from "@/features/dfd";
import { GuidedWizard } from "@/features/guided-wizard";
import { RightPanelContent } from "./RightPanelContent";
import { ModelPageDialogs } from "./ModelPageDialogs";
import { RightPanelTabs } from "./RightPanelTabs";
import { TAB_LABELS } from "./model-page-config";
import { useModelPage } from "./useModelPage";
import { cn } from "@/lib/utils";
import { useResponsive } from "@/hooks/use-mobile";
import {
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  LayoutGrid,
  Shield,
} from "lucide-react";
import type { ComponentType } from "@/types/canvas";

export default function ModelPage() {
  const params = useParams();
  const router = useRouter();
  const modelId = params.id as string;
  const { isBelowLg } = useResponsive();

  const {
    model,
    isLoading,
    error,
    refetch,
    allModels,
    expertResult,
    activeTabType,
    activeSequenceDiagramId,
    activeDfdId,
    catalogComponent,
    saveStatus,
    mounted,
    wizardOpen,
    setWizardOpen,
    mobileLeftDrawerOpen,
    setMobileLeftDrawerOpen,
    mobileRightDrawerOpen,
    setMobileRightDrawerOpen,
    viewingDocId,
    setViewingDocId,
    gapAnalysisOpen,
    setGapAnalysisOpen,
    triggerImport,
    restoreConfirm,
    activeRightPanel,
    setActiveRightPanel,
    leftPanelCollapsed,
    rightPanelCollapsed,
    toggleLeftPanel,
    toggleRightPanel,
    threatCatalogOpen,
    closeThreatCatalog,
    handleWizardComplete,
    handleModelChange,
    handleReExtract,
    handleRestoreConfirm,
    handleRestoreCancel,
    handleImportReady,
  } = useModelPage(modelId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-lg text-muted-foreground">
          Failed to load threat model
        </p>
        <div className="flex gap-3">
          <Button onClick={() => refetch()}>Try again</Button>
          <Button variant="link" onClick={() => router.push("/dashboard")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const rightTabs = (
    <RightPanelTabs
      modelId={modelId}
      activeRightPanel={activeRightPanel}
      onTabChange={setActiveRightPanel}
    />
  );

  const rightContent = (
    <RightPanelContent
      activeRightPanel={activeRightPanel}
      modelId={modelId}
      mounted={mounted}
      allModels={allModels}
      expertResult={expertResult}
      triggerImport={triggerImport}
      handleReExtract={handleReExtract}
      setGapAnalysisOpen={setGapAnalysisOpen}
      setViewingDocId={setViewingDocId}
      setActiveRightPanel={setActiveRightPanel}
      onNavigateToModel={(id) => router.push(`/models/${id}`)}
    />
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Toolbar
        currentModelId={modelId}
        currentModelName={model?.name ?? "Untitled"}
        onModelChange={handleModelChange}
        saveStatus={saveStatus}
        modelStatus={model?.status}
        modelTags={model?.tags}
        showBackButton
        onBack={() =>
          router.push(
            model?.projectId ? `/projects/${model.projectId}` : "/dashboard",
          )
        }
        projectId={model?.projectId}
        projectName={model?.projectName || model?.project?.name}
        onImportReady={handleImportReady}
      />

      <DiagramTabs threatModelId={modelId} />

      {isBelowLg && activeTabType === "architecture" && (
        <div className="absolute bottom-4 left-4 z-50 flex gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="h-12 w-12 rounded-full shadow-lg"
            onClick={() => setMobileLeftDrawerOpen(true)}
            aria-label="Open component palette"
          >
            <LayoutGrid className="h-5 w-5" />
          </Button>
        </div>
      )}
      {isBelowLg && activeTabType === "architecture" && (
        <div className="absolute bottom-4 right-4 z-50 flex gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="h-12 w-12 rounded-full shadow-lg"
            onClick={() => setMobileRightDrawerOpen(true)}
            aria-label="Open threats panel"
          >
            <Shield className="h-5 w-5" />
          </Button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {activeTabType === "architecture" && !isBelowLg && (
          <div
            className={cn(
              // shrink-0 + overflow-hidden mirror the right rail: without
              // shrink-0 the w-56 basis can be compressed in a narrow row, and
              // overflow-hidden is what clamps the palette's inner scroller.
              "flex shrink-0 flex-col bg-background border-r overflow-hidden transition-all duration-200",
              leftPanelCollapsed ? "w-10" : "w-56",
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleLeftPanel}
                  className="flex items-center justify-center h-10 border-b hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  aria-label={
                    leftPanelCollapsed ? "Expand panel" : "Collapse panel"
                  }
                >
                  {leftPanelCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {leftPanelCollapsed ? "Expand panel" : "Collapse panel"}
              </TooltipContent>
            </Tooltip>
            {!leftPanelCollapsed && (
              <div className="flex-1 overflow-hidden">
                <ComponentPalette />
              </div>
            )}
          </div>
        )}

        {/* min-w-0: as a row flex item this defaults to min-width:auto (min-content),
            so any in-flow wide child would refuse to shrink and push the rails
            off-screen. Safe today only because React Flow renders into an
            absolutely-positioned transformed viewport. */}
        <main className="flex-1 min-w-0 relative">
          {activeTabType === "architecture" ? (
            <ThreatModelCanvasProvider />
          ) : activeTabType === "dfd" && activeDfdId ? (
            <DFDCanvasWrapper threatModelId={modelId} dfdId={activeDfdId} />
          ) : activeTabType === "sequence" && activeSequenceDiagramId ? (
            <SequenceCanvas
              threatModelId={modelId}
              sequenceDiagramId={activeSequenceDiagramId}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {activeTabType === "dfd"
                ? "Select a Data Flow Diagram"
                : "Select a sequence diagram"}
            </div>
          )}
        </main>

        {!isBelowLg && (
          <div
            className={cn(
              "flex flex-col bg-background border-l transition-all duration-200 overflow-hidden",
              rightPanelCollapsed ? "w-10" : "w-96",
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleRightPanel}
                  className="flex items-center justify-center h-10 shrink-0 border-b hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  aria-label={
                    rightPanelCollapsed ? "Expand panel" : "Collapse panel"
                  }
                >
                  {rightPanelCollapsed ? (
                    <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <PanelRightClose className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {rightPanelCollapsed ? "Expand panel" : "Collapse panel"}
              </TooltipContent>
            </Tooltip>
            {!rightPanelCollapsed && (
              <>
                {rightTabs}
                {rightContent}
              </>
            )}
          </div>
        )}
      </div>

      <Sheet open={mobileLeftDrawerOpen} onOpenChange={setMobileLeftDrawerOpen}>
        <SheetContent side="left" className="w-[300px] sm:w-[380px] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Components</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto">
            <ComponentPalette />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={mobileRightDrawerOpen}
        onOpenChange={setMobileRightDrawerOpen}
      >
        <SheetContent
          side="right"
          className="w-[300px] sm:w-[380px] p-0 flex flex-col"
        >
          <SheetHeader className="p-4 border-b">
            <SheetTitle>{TAB_LABELS[activeRightPanel] ?? "Panel"}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden flex flex-col">
            {rightTabs}
            {rightContent}
          </div>
        </SheetContent>
      </Sheet>

      <ModelPageDialogs
        restoreConfirm={restoreConfirm}
        onRestoreCancel={handleRestoreCancel}
        onRestoreConfirm={handleRestoreConfirm}
        threatCatalogOpen={threatCatalogOpen}
        onCloseThreatCatalog={closeThreatCatalog}
        onAddCatalogThreat={() => setActiveRightPanel("threats")}
        catalogComponentType={
          catalogComponent?.data?.type as ComponentType | undefined
        }
        catalogComponentName={
          catalogComponent?.data?.name as string | undefined
        }
        viewingDocId={viewingDocId}
        onCloseViewer={() => setViewingDocId(null)}
        gapAnalysisOpen={gapAnalysisOpen}
        onGapAnalysisOpenChange={setGapAnalysisOpen}
        modelId={modelId}
      />

      <GuidedWizard
        open={wizardOpen}
        onOpenChange={(open) => {
          if (!open) localStorage.setItem(`wizard-dismissed-${modelId}`, "1");
          setWizardOpen(open);
        }}
        onComplete={handleWizardComplete}
      />
    </div>
  );
}
