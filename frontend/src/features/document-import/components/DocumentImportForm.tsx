"use client";

import { FileUp, Link, ClipboardPaste, Image, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDropzone } from "./FileDropzone";
import { ImageDropzone } from "./ImageDropzone";
import { UrlImportForm } from "./UrlImportForm";
import { TextPasteForm } from "./TextPasteForm";
import type { ImportTab } from "../hooks/useDocumentImportDialog";

interface DocumentImportFormProps {
  activeTab: ImportTab;
  onTabChange: (tab: ImportTab) => void;
  onFileSelect: (file: File) => void;
  onExtractDiagram: (file: File) => void;
  onUrlSubmit: (url: string) => void;
  onTextSubmit: (text: string) => void;
  isProcessing: boolean;
  visionSupported: boolean;
  supportedProviders?: string[];
}

export function DocumentImportForm({
  activeTab,
  onTabChange,
  onFileSelect,
  onExtractDiagram,
  onUrlSubmit,
  onTextSubmit,
  isProcessing,
  visionSupported,
  supportedProviders,
}: DocumentImportFormProps) {
  return (
    <>
      <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 mb-4">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">
            What happens after import:
          </span>{" "}
          Your document is saved in the Docs tab for reference. AI extracts
          components, data flows, and security requirements. If your canvas
          already has components, you will review a merge before anything
          changes. You can re-import updated documents later.
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => onTabChange(v as ImportTab)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="file" disabled={isProcessing}>
            <FileUp className="h-4 w-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="diagram" disabled={isProcessing}>
            <Image className="h-4 w-4 mr-2" />
            Screenshot
          </TabsTrigger>
          <TabsTrigger value="url" disabled={isProcessing}>
            <Link className="h-4 w-4 mr-2" />
            URL
          </TabsTrigger>
          <TabsTrigger value="paste" disabled={isProcessing}>
            <ClipboardPaste className="h-4 w-4 mr-2" />
            Paste
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="file" className="mt-0">
            <FileDropzone onFileSelect={onFileSelect} disabled={isProcessing} />
          </TabsContent>
          <TabsContent value="diagram" className="mt-0">
            <ImageDropzone
              onFileSelect={onExtractDiagram}
              disabled={isProcessing}
              visionSupported={visionSupported}
              supportedProviders={supportedProviders}
            />
          </TabsContent>
          <TabsContent value="url" className="mt-0">
            <UrlImportForm onSubmit={onUrlSubmit} disabled={isProcessing} />
          </TabsContent>
          <TabsContent value="paste" className="mt-0">
            <TextPasteForm onSubmit={onTextSubmit} disabled={isProcessing} />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}
