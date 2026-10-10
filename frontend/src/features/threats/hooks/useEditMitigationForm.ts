"use client";

import { useState, useCallback, useMemo } from "react";
import { useRequirements } from "@/features/requirements";
import type { Mitigation, MitigationStrategy, EvidenceLink } from "../types";

const EVIDENCE_TYPES = [
  "ticket",
  "document",
  "screenshot",
  "test_report",
  "scan_result",
  "manual",
];

const CONTROL_CATEGORIES = [
  "IAM",
  "ENCRYPTION",
  "ACCESS_CONTROL",
  "NETWORK",
  "LOGGING",
  "INPUT_VALIDATION",
  "SECRETS",
  "BACKUP",
  "MONITORING",
  "SUPPLY_CHAIN",
];

export { EVIDENCE_TYPES, CONTROL_CATEGORIES };

interface UseEditMitigationFormProps {
  mitigation: Mitigation;
  modelId?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    description: string;
    status: string;
    priority: string;
    strategy: MitigationStrategy;
    notes?: string | null;
    controlCategory?: string | null;
    testCriteria?: string | null;
    testResult?: string | null;
    evidenceLinks?: EvidenceLink[] | null;
    requirementIds?: string[] | null;
    effectivenessScore?: number | null;
    verified?: boolean;
    obligation?: "REQUIRED" | "RECOMMENDED";
  }) => void;
}

export function useEditMitigationForm({
  mitigation,
  modelId,
  onOpenChange,
  onSubmit,
}: UseEditMitigationFormProps) {
  const { data: dbRequirements = [] } = useRequirements(modelId ?? "");

  const [description, setDescription] = useState(mitigation.description);
  const [status, setStatus] = useState(mitigation.status);
  const [priority, setPriority] = useState(mitigation.priority);
  const [strategy, setStrategy] = useState<MitigationStrategy>(
    mitigation.strategy,
  );
  const [notes, setNotes] = useState(mitigation.notes || "");
  const [verified, setVerified] = useState(mitigation.verified ?? false);
  const [obligation, setObligation] = useState<string>(
    mitigation.obligation || "RECOMMENDED",
  );
  const [effectivenessScore, setEffectivenessScore] = useState<number | null>(
    mitigation.effectivenessScore ?? null,
  );
  const [controlCategory, setControlCategory] = useState(
    mitigation.controlCategory || "",
  );
  const [testCriteria, setTestCriteria] = useState(
    mitigation.testCriteria || "",
  );
  const [testResult, setTestResult] = useState(mitigation.testResult || "");
  const [evidenceLinks, setEvidenceLinks] = useState<EvidenceLink[]>(
    mitigation.evidenceLinks ?? [],
  );
  const [newLinkType, setNewLinkType] = useState("ticket");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set((mitigation.requirements ?? []).map((r) => r.id)),
  );

  const aiCitedReqIds = useMemo(() => {
    const matches = mitigation.description.matchAll(/\[req:([^\]]+)\]/gi);
    return new Set(Array.from(matches, (m) => m[1].trim()));
  }, [mitigation.description]);

  const resetForm = useCallback(() => {
    setDescription(mitigation.description);
    setStatus(mitigation.status);
    setPriority(mitigation.priority);
    setStrategy(mitigation.strategy);
    setNotes(mitigation.notes || "");
    setVerified(mitigation.verified ?? false);
    setObligation(mitigation.obligation || "RECOMMENDED");
    setEffectivenessScore(mitigation.effectivenessScore ?? null);
    setControlCategory(mitigation.controlCategory || "");
    setTestCriteria(mitigation.testCriteria || "");
    setTestResult(mitigation.testResult || "");
    setEvidenceLinks(mitigation.evidenceLinks ?? []);
    setSelectedIds(new Set((mitigation.requirements ?? []).map((r) => r.id)));
    setNewLinkUrl("");
    setNewLinkTitle("");
  }, [mitigation]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) resetForm();
      onOpenChange(newOpen);
    },
    [onOpenChange, resetForm],
  );

  const addEvidenceLink = () => {
    if (!newLinkUrl.trim()) return;
    setEvidenceLinks((prev) => [
      ...prev,
      {
        type: newLinkType,
        url: newLinkUrl.trim(),
        title: newLinkTitle.trim() || newLinkType,
      },
    ]);
    setNewLinkUrl("");
    setNewLinkTitle("");
  };

  const removeEvidenceLink = (i: number) => {
    setEvidenceLinks((prev) => prev.filter((_, idx) => idx !== i));
  };

  const toggleRequirement = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    const requirementIds = Array.from(selectedIds);
    onSubmit({
      description,
      status,
      priority,
      strategy,
      notes: notes.trim() || null,
      controlCategory: controlCategory || null,
      testCriteria: testCriteria.trim() || null,
      testResult: testResult || null,
      evidenceLinks: evidenceLinks.length > 0 ? evidenceLinks : null,
      requirementIds: requirementIds.length > 0 ? requirementIds : null,
      effectivenessScore,
      verified,
      obligation: obligation as "REQUIRED" | "RECOMMENDED",
    });
    handleOpenChange(false);
  };

  return {
    dbRequirements,
    description,
    setDescription,
    status,
    setStatus,
    priority,
    setPriority,
    strategy,
    setStrategy,
    notes,
    setNotes,
    verified,
    setVerified,
    obligation,
    setObligation,
    effectivenessScore,
    setEffectivenessScore,
    controlCategory,
    setControlCategory,
    testCriteria,
    setTestCriteria,
    testResult,
    setTestResult,
    evidenceLinks,
    newLinkType,
    setNewLinkType,
    newLinkUrl,
    setNewLinkUrl,
    newLinkTitle,
    setNewLinkTitle,
    selectedIds,
    aiCitedReqIds,
    handleOpenChange,
    addEvidenceLink,
    removeEvidenceLink,
    toggleRequirement,
    handleSubmit,
  };
}
