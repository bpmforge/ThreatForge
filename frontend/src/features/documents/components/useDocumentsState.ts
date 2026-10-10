"use client";

import { useState } from "react";
import { useDocuments, useDeleteDocument } from "../hooks/useDocuments";
export function useDocumentsState(modelId: string) {
  const { data: documents = [], isLoading } = useDocuments(modelId);
  const deleteMutation = useDeleteDocument(modelId);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? documents.filter((d) =>
        d.name.toLowerCase().includes(search.toLowerCase()),
      )
    : documents;

  const reqCount = documents.reduce((sum, d) => sum + d._count.requirements, 0);

  return {
    documents,
    isLoading,
    deleteId,
    setDeleteId,
    search,
    setSearch,
    filtered,
    reqCount,
    deleteMutation,
  };
}
