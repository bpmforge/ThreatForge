"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, ExternalLink } from "lucide-react";
import { EVIDENCE_TYPES } from "../hooks/useEditMitigationForm";
import type { EvidenceLink } from "../types";

interface EvidenceLinksSectionProps {
  evidenceLinks: EvidenceLink[];
  newLinkType: string;
  newLinkUrl: string;
  newLinkTitle: string;
  onTypeChange: (v: string) => void;
  onUrlChange: (v: string) => void;
  onTitleChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}

export function EvidenceLinksSection({
  evidenceLinks,
  newLinkType,
  newLinkUrl,
  newLinkTitle,
  onTypeChange,
  onUrlChange,
  onTitleChange,
  onAdd,
  onRemove,
}: EvidenceLinksSectionProps) {
  return (
    <div className="space-y-2">
      <Label>Evidence Links</Label>
      {evidenceLinks.length > 0 && (
        <div className="space-y-1 mb-2">
          {evidenceLinks.map((link, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-1.5 bg-muted rounded text-xs"
            >
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                {link.type}
              </span>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-blue-600 hover:underline flex items-center gap-1"
              >
                {link.title}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              <button
                onClick={() => onRemove(i)}
                className="text-muted-foreground hover:text-red-500"
                aria-label="Remove evidence link"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Select value={newLinkType} onValueChange={onTypeChange}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVIDENCE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={newLinkTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Title (e.g. JIRA-123)"
          className="h-8 text-xs flex-1"
        />
      </div>
      <div className="flex gap-2">
        <Input
          value={newLinkUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://..."
          className="h-8 text-xs flex-1"
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2"
          onClick={onAdd}
          disabled={!newLinkUrl.trim()}
          aria-label="Add evidence link"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
