"use client";

import { useState, useEffect } from "react";
import {
  useCanvasStore,
  type CanvasNode,
  type CanvasEdge,
} from "@/stores/canvas";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import type { SaveStatus } from "@/features/auto-save";
import type { ModelStatus } from "@/features/dashboard";
import { useToolbarActions } from "../hooks/useToolbarActions";
import { useDocumentImportHandler } from "../hooks/useDocumentImportHandler";
import { useReadiness } from "@/features/stride-guidance";
import { DocumentImportDialog } from "@/features/document-import";
import { MergeReviewDialog } from "@/features/document-import/components/MergeReviewDialog";
import { DiagramImportDialog } from "@/features/integrations/diagram-import";
import { SharePointImportDialog } from "@/features/integrations/sharepoint";
import { toast } from "sonner";
import { NavigationBreadcrumb } from "./NavigationBreadcrumb";
import { UndoRedoButtons } from "./UndoRedoButtons";
import { ImportSection } from "./ImportSection";
import { ToolActions } from "./ToolActions";

interface ToolbarProps {
  currentModelId: string | null;
  currentModelName: string;
  onModelChange: (id: string | null, name: string) => void;
  saveStatus?: SaveStatus;
  modelStatus?: ModelStatus;
  modelTags?: string[];
  showBackButton?: boolean;
  onBack?: () => void;
  breadcrumbs?: { label: string; href?: string }[];
  projectId?: string | null;
  projectName?: string | null;
  onImportReady?: (trigger: () => void) => void;
}

export function Toolbar({
  currentModelId,
  currentModelName,
  onModelChange,
  saveStatus = "idle",
  modelStatus,
  modelTags = [],
  showBackButton = false,
  projectId,
  projectName,
  onImportReady,
}: ToolbarProps) {
  const isDirty = useCanvasStore((s) => s.isDirty);
  const autoLayout = useCanvasStore((s) => s.autoLayout);
  const addNodes = useCanvasStore((s) => s.addNodes);
  const addEdges = useCanvasStore((s) => s.addEdges);

  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showDocumentImport, setShowDocumentImport] = useState(false);
  const [showDiagramImport, setShowDiagramImport] = useState(false);
  const [showSharePointImport, setShowSharePointImport] = useState(false);

  useEffect(() => {
    onImportReady?.(() => setShowDocumentImport(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readinessResult = useReadiness();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const {
    showMergeReview,
    setShowMergeReview,
    pendingMerge,
    handleDocumentImported,
    handleMergeConfirm,
    handleMergeCancel,
  } = useDocumentImportHandler(currentModelId);

  const {
    saving,
    loading,
    exporting,
    models,
    fetchModels,
    handleSave,
    handleCreate,
    handleLoad,
    handleNew,
    handleExportJSON,
    handleExportYAML,
    handleExportPNG,
    handleExportSVG,
    handleExportPDF,
    handleExportMermaid,
    handleExportDrawio,
    handleExportThreatModelCode,
    handleExportDocx,
  } = useToolbarActions({ currentModelId, currentModelName, onModelChange });

  const onSaveClick = async () => {
    if (!currentModelId) setShowSaveDialog(true);
    else await handleSave();
  };

  const onCreateSave = async (name: string) => {
    const success = await handleCreate(name);
    if (success) setShowSaveDialog(false);
  };

  const onLoadModel = async (modelId: string) => {
    const success = await handleLoad(modelId);
    if (success) setShowLoadDialog(false);
  };

  return (
    <div className="h-12 bg-background border-b border flex items-center px-4 gap-4">
      <NavigationBreadcrumb
        showBackButton={showBackButton}
        projectId={projectId}
        projectName={projectName}
        currentModelId={currentModelId}
        currentModelName={currentModelName}
        modelStatus={modelStatus}
        modelTags={modelTags}
        saveStatus={saveStatus}
        isDirty={isDirty}
      />

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <UndoRedoButtons
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          autoLayout={autoLayout}
        />

        <div className="w-px h-6 bg-border" />

        <ImportSection
          handleNew={handleNew}
          setShowDocumentImport={setShowDocumentImport}
          setShowDiagramImport={setShowDiagramImport}
          setShowSharePointImport={setShowSharePointImport}
          showLoadDialog={showLoadDialog}
          setShowLoadDialog={setShowLoadDialog}
          models={models}
          loading={loading}
          onLoad={onLoadModel}
          onFetchModels={fetchModels}
        />

        <ToolActions
          currentModelId={currentModelId}
          currentModelName={currentModelName}
          saving={saving}
          exporting={exporting}
          onSaveClick={onSaveClick}
          showSaveDialog={showSaveDialog}
          setShowSaveDialog={setShowSaveDialog}
          onCreateSave={onCreateSave}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          showSaveAsTemplate={showSaveAsTemplate}
          setShowSaveAsTemplate={setShowSaveAsTemplate}
          showTutorial={showTutorial}
          setShowTutorial={setShowTutorial}
          readinessResult={readinessResult}
          handleExportJSON={handleExportJSON}
          handleExportYAML={handleExportYAML}
          handleExportPNG={handleExportPNG}
          handleExportSVG={handleExportSVG}
          handleExportPDF={handleExportPDF}
          handleExportMermaid={handleExportMermaid}
          handleExportDrawio={handleExportDrawio}
          handleExportThreatModelCode={handleExportThreatModelCode}
          handleExportDocx={handleExportDocx}
        />

        <DocumentImportDialog
          open={showDocumentImport}
          onOpenChange={setShowDocumentImport}
          onDocumentImported={(doc) => {
            setShowDocumentImport(false);
            handleDocumentImported(doc);
          }}
        />

        {pendingMerge && (
          <MergeReviewDialog
            open={showMergeReview}
            onOpenChange={setShowMergeReview}
            mergePlan={pendingMerge.plan}
            onConfirm={handleMergeConfirm}
            onCancel={handleMergeCancel}
          />
        )}

        <DiagramImportDialog
          open={showDiagramImport}
          onOpenChange={setShowDiagramImport}
          onImportComplete={(nodes: unknown[], edges: unknown[]) => {
            addNodes(nodes as CanvasNode[]);
            addEdges(edges as CanvasEdge[]);
            toast.success(
              `Imported ${nodes.length} components and ${edges.length} connections`,
            );
          }}
        />

        <SharePointImportDialog
          open={showSharePointImport}
          onOpenChange={setShowSharePointImport}
          onImport={(content, filename) => {
            setShowDocumentImport(true);
            setShowSharePointImport(false);
            toast.success(`Loaded "${filename}" from SharePoint`);
          }}
        />
      </div>
    </div>
  );
}
