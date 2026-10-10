"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, FolderOpen, ChevronRight } from "lucide-react";
import type { useSharePointImport } from "./useSharePointImport";

type H = ReturnType<typeof useSharePointImport>;

export function SharePointSitesStep({ h }: { h: H }) {
  return (
    <ScrollArea className="max-h-72 py-2">
      <div className="space-y-1.5 pr-2">
        {h.sites.map((site) => (
          <button
            key={site.id}
            type="button"
            onClick={() => h.handleSelectSite(site)}
            disabled={h.busy}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted/50 text-sm text-left"
          >
            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1">{site.displayName || site.name}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
        {h.sites.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No sites found
          </p>
        )}
      </div>
    </ScrollArea>
  );
}

export function SharePointDrivesStep({ h }: { h: H }) {
  return (
    <ScrollArea className="max-h-72 py-2">
      <div className="space-y-1.5 pr-2">
        {h.drives.map((drive) => (
          <button
            key={drive.id}
            type="button"
            onClick={() => h.handleSelectDrive(drive)}
            disabled={h.busy}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted/50 text-sm text-left"
          >
            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1">{drive.name}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

export function SharePointFilesStep({ h }: { h: H }) {
  return (
    <ScrollArea className="max-h-72 py-2">
      <div className="space-y-1.5 pr-2">
        {h.files.map((file) => (
          <button
            key={file.id}
            type="button"
            onClick={() => h.handleSelectFile(file)}
            disabled={h.busy}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted/50 text-sm text-left"
          >
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {(file.size / 1024).toFixed(0)} KB
            </span>
          </button>
        ))}
        {h.files.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No files found
          </p>
        )}
      </div>
    </ScrollArea>
  );
}

export function SharePointLoadingStep() {
  return (
    <div className="flex items-center justify-center py-8 gap-3">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm text-muted-foreground">Fetching document…</span>
    </div>
  );
}
