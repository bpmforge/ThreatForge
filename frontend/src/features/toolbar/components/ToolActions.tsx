"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { History, FileCode, GraduationCap, BookOpen } from "lucide-react";
import { SettingsDialog } from "@/features/settings";
import { ExportMenu } from "./ExportMenu";
import { SaveDialog } from "./SaveDialog";
import { VersionHistoryDialog } from "@/components/dialogs";
import { SaveAsTemplateDialog } from "@/features/model-templates";
import {
  ReadinessIndicator,
  StrideTutorialDialog,
} from "@/features/stride-guidance";
import type { ReadinessResult } from "@/features/stride-guidance";
import { ExpertAnalysisButton } from "@/features/ai";
import { useUIStore } from "@/stores/ui-store";
import { toast } from "sonner";

interface ToolActionsProps {
  currentModelId: string | null;
  currentModelName: string;
  saving: boolean;
  exporting: boolean;
  onSaveClick: () => Promise<void>;
  showSaveDialog: boolean;
  setShowSaveDialog: (open: boolean) => void;
  onCreateSave: (name: string) => Promise<void>;
  showHistory: boolean;
  setShowHistory: (open: boolean) => void;
  showSettings: boolean;
  setShowSettings: (open: boolean) => void;
  showSaveAsTemplate: boolean;
  setShowSaveAsTemplate: (open: boolean) => void;
  showTutorial: boolean;
  setShowTutorial: (open: boolean) => void;
  readinessResult: ReadinessResult;
  handleExportJSON: () => void;
  handleExportYAML: () => void;
  handleExportPNG: () => void;
  handleExportSVG: () => void;
  handleExportPDF: () => void;
  handleExportMermaid: () => void;
  handleExportDrawio: () => void;
  handleExportThreatModelCode: () => void;
  handleExportDocx: () => void;
}

export function ToolActions({
  currentModelId,
  currentModelName,
  saving,
  exporting,
  onSaveClick,
  showSaveDialog,
  setShowSaveDialog,
  onCreateSave,
  showHistory,
  setShowHistory,
  showSettings,
  setShowSettings,
  showSaveAsTemplate,
  setShowSaveAsTemplate,
  showTutorial,
  setShowTutorial,
  readinessResult,
  handleExportJSON,
  handleExportYAML,
  handleExportPNG,
  handleExportSVG,
  handleExportPDF,
  handleExportMermaid,
  handleExportDrawio,
  handleExportThreatModelCode,
  handleExportDocx,
}: ToolActionsProps) {
  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={onSaveClick}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save"}
      </Button>

      <SaveDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        saving={saving}
        onSave={onCreateSave}
      />

      <ExportMenu
        exporting={exporting}
        onExportJSON={handleExportJSON}
        onExportYAML={handleExportYAML}
        onExportPNG={handleExportPNG}
        onExportSVG={handleExportSVG}
        onExportPDF={handleExportPDF}
        onExportMermaid={handleExportMermaid}
        onExportDrawio={handleExportDrawio}
        onExportThreatModelCode={handleExportThreatModelCode}
        onExportDocx={handleExportDocx}
        onExportRiskRegister={
          currentModelId
            ? async () => {
                const { exportRiskRegister } = await import(
                  "@/features/export/services/risk-register-export"
                );
                try {
                  await exportRiskRegister(currentModelId);
                  toast.success("Risk register downloaded");
                } catch {
                  toast.error("Failed to export risk register");
                }
              }
            : undefined
        }
      />

      <div className="w-px h-6 bg-border" />

      <ExpertAnalysisButton modelId={currentModelId} />

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => useUIStore.getState().openThreatCatalog()}
              className="h-8 w-8"
              aria-label="Browse Threat Catalog"
            >
              <BookOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Threat Catalog</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSaveAsTemplate(true)}
              disabled={!currentModelId}
              className="h-8 w-8"
              aria-label="Save as Template"
            >
              <FileCode className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Save as Template</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowHistory(true)}
        disabled={!currentModelId}
      >
        <History className="h-4 w-4 mr-1" />
        History
      </Button>

      <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
        Settings
      </Button>

      <div className="w-px h-6 bg-border" />

      <ReadinessIndicator result={readinessResult} />

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTutorial(true)}
              className="h-8 w-8"
              aria-label="STRIDE Tutorial"
            >
              <GraduationCap className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>STRIDE Tutorial</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <VersionHistoryDialog
        open={showHistory}
        onOpenChange={setShowHistory}
        modelId={currentModelId}
      />

      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        orgId={currentModelId}
      />

      {currentModelId && (
        <SaveAsTemplateDialog
          open={showSaveAsTemplate}
          onOpenChange={setShowSaveAsTemplate}
          modelId={currentModelId}
          modelName={currentModelName}
        />
      )}

      <StrideTutorialDialog
        open={showTutorial}
        onOpenChange={setShowTutorial}
      />
    </>
  );
}
