"use client";

import { Shield } from "lucide-react";
import { EmptyState } from "./EmptyState";

interface EmptyThreatListProps {
  onAddThreat: () => void;
  onSuggestThreats?: () => void;
}

export function EmptyThreatList({
  onAddThreat,
  onSuggestThreats,
}: EmptyThreatListProps) {
  const actions: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
  }> = [
    {
      label: "Add Threat",
      onClick: onAddThreat,
    },
  ];

  // NOTE: The onSuggestThreats prop is wired to the Threat Library dialog at
  // the parent (ThreatPanelList) — it browses curated STRIDE templates, not
  // AI-generated suggestions. The real AI lives in the dedicated "AI" tab.
  // Label matches behavior; AI has its own entry point.
  if (onSuggestThreats) {
    actions.push({
      label: "Browse Library",
      onClick: onSuggestThreats,
      variant: "outline",
    });
  }

  return (
    <EmptyState
      icon={Shield}
      title="No threats identified"
      description="Add a threat manually, browse the STRIDE library, or switch to the AI tab to generate threats."
      actions={actions}
    />
  );
}
