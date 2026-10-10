"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileUp, Workflow, BookOpen } from "lucide-react";
import { LoadDialog } from "./LoadDialog";
import type { ThreatModel } from "../types";

interface ImportSectionProps {
  handleNew: () => void;
  setShowDocumentImport: (open: boolean) => void;
  setShowDiagramImport: (open: boolean) => void;
  setShowSharePointImport: (open: boolean) => void;
  showLoadDialog: boolean;
  setShowLoadDialog: (open: boolean) => void;
  models: ThreatModel[];
  loading: boolean;
  onLoad: (modelId: string) => Promise<void>;
  onFetchModels: () => void;
}

export function ImportSection({
  handleNew,
  setShowDocumentImport,
  setShowDiagramImport,
  setShowSharePointImport,
  showLoadDialog,
  setShowLoadDialog,
  models,
  loading,
  onLoad,
  onFetchModels,
}: ImportSectionProps) {
  return (
    <>
      <Button variant="outline" size="sm" onClick={handleNew}>
        New
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <FileUp className="h-4 w-4 mr-1" />
            Import
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Import source material
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDocumentImport(true)}
            className="flex-col items-start gap-0.5 py-2"
          >
            <span className="flex items-center gap-2 font-medium">
              <FileUp className="h-4 w-4" />
              Architecture Document
            </span>
            <span className="text-[11px] text-muted-foreground pl-6">
              PDF, DOCX, Markdown, Terraform, image, URL, or paste text. AI
              extracts components and builds your diagram.
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowDiagramImport(true)}
            className="flex-col items-start gap-0.5 py-2"
          >
            <span className="flex items-center gap-2 font-medium">
              <Workflow className="h-4 w-4" />
              Existing Diagram File
            </span>
            <span className="text-[11px] text-muted-foreground pl-6">
              Draw.io, Mermaid, Lucidchart, or Threat Dragon export.
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowSharePointImport(true)}
            className="flex-col items-start gap-0.5 py-2"
          >
            <span className="flex items-center gap-2 font-medium">
              <BookOpen className="h-4 w-4" />
              SharePoint Document
            </span>
            <span className="text-[11px] text-muted-foreground pl-6">
              Browse SharePoint via Microsoft Graph API. Requires Azure AD app.
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LoadDialog
        open={showLoadDialog}
        onOpenChange={setShowLoadDialog}
        models={models}
        loading={loading}
        onLoad={onLoad}
        onFetchModels={onFetchModels}
      />
    </>
  );
}
