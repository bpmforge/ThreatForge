/**
 * DiagramTabs - Tab bar for switching between architecture, DFD, and sequence diagrams
 */
"use client";

import { DeleteConfirmDialog } from "@/components/dialogs/DeleteAlertDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Network,
  GitBranch,
  Workflow,
} from "lucide-react";
import { useDiagramTabs } from "../hooks/useDiagramTabs";
import { DiagramNameDialog } from "./DiagramNameDialog";

interface DiagramTabsProps {
  threatModelId: string | null;
}

export function DiagramTabs({ threatModelId }: DiagramTabsProps) {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    showNewDialog,
    setShowNewDialog,
    newDiagramType,
    setNewDiagramType,
    showRenameDialog,
    setShowRenameDialog,
    selectedTab,
    inputValue,
    setInputValue,
    deleteConfirm,
    setDeleteConfirm,
    handleAddDiagram,
    handleRename,
    handleDeleteClick,
    handleDeleteConfirm,
    openRenameDialog,
    isCreating,
    isRenaming,
  } = useDiagramTabs(threatModelId);

  return (
    <div
      // shrink-0 is load-bearing: overflow-x-auto makes the computed overflow-y
      // `auto` too, which zeroes this row's automatic minimum size — without it
      // the tab strip can be compressed to nothing and clip its own tabs.
      className="flex shrink-0 items-center gap-1 px-2 py-1 bg-muted border-b overflow-x-auto scrollbar-hide"
    >
      <div
        className="flex items-center gap-1"
        role="tablist"
        aria-label="Diagram tabs"
      >
        {tabs.map((tab) => (
          // A real <button> can't legally contain the nested kebab-menu
          // button below (buttons can't nest), so the tab itself is a
          // div with role="tab" + tabIndex, activated by click or
          // keyboard (Enter/Space) — the standard accessible tab pattern
          // for tabs that carry interactive children.
          <div
            key={tab.id}
            role="tab"
            tabIndex={0}
            aria-selected={activeTabId === tab.id}
            className={`
            group flex items-center gap-1 px-3 py-1.5 rounded-t-md text-sm cursor-pointer
            transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
            ${
              activeTabId === tab.id
                ? "bg-background text-foreground border border-b-0"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
            }
          `}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveTab(tab.id);
              }
            }}
          >
            {tab.type === "architecture" ? (
              <Network className="h-3.5 w-3.5" />
            ) : tab.type === "dfd" ? (
              <Workflow className="h-3.5 w-3.5" />
            ) : (
              <GitBranch className="h-3.5 w-3.5" />
            )}
            <span className="truncate max-w-32">{tab.label}</span>

            {tab.closeable && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    aria-label={`More options for ${tab.label}`}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded cursor-pointer"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => openRenameDialog(tab)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteClick(tab)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            disabled={!threatModelId}
            title={threatModelId ? "Add diagram" : "Save model first"}
            aria-label="Add diagram"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => {
              setNewDiagramType("dfd");
              setInputValue("");
              setShowNewDialog(true);
            }}
          >
            <Workflow className="h-4 w-4 mr-2" />
            Data Flow Diagram
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setNewDiagramType("sequence");
              setInputValue("");
              setShowNewDialog(true);
            }}
          >
            <GitBranch className="h-4 w-4 mr-2" />
            Sequence Diagram
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DiagramNameDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        mode="create"
        diagramType={newDiagramType}
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleAddDiagram}
        isPending={isCreating}
      />

      <DiagramNameDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        mode="rename"
        diagramType={selectedTab?.type === "dfd" ? "dfd" : "sequence"}
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleRename}
        isPending={isRenaming}
      />

      <DeleteConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title={`Delete ${deleteConfirm?.type === "dfd" ? "Data Flow Diagram" : "Sequence Diagram"}?`}
        name={deleteConfirm?.label}
      />
    </div>
  );
}
