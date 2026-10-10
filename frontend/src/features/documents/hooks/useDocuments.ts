/**
 * TanStack Query hooks for document management
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "../services/api";

const QUERY_KEYS = {
  documents: (modelId: string) => ["documents", modelId] as const,
  document: (modelId: string, docId: string) =>
    ["documents", modelId, docId] as const,
  gaps: (modelId: string) => ["document-gaps", modelId] as const,
};

export function useDocuments(modelId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.documents(modelId ?? ""),
    queryFn: () => api.getDocuments(modelId!),
    enabled: !!modelId,
  });
}

export function useDocument(modelId: string | null, docId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.document(modelId ?? "", docId ?? ""),
    queryFn: () => api.getDocument(modelId!, docId!),
    enabled: !!modelId && !!docId,
  });
}

export function useDeleteDocument(modelId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (docId: string) => api.deleteDocument(modelId!, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documents(modelId!),
      });
      toast.success("Document removed");
    },
    onError: (err: Error) => {
      toast.error("Delete failed", { description: err.message });
    },
  });
}

export function useDocumentGaps(modelId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.gaps(modelId ?? ""),
    queryFn: () => api.getDocumentGaps(modelId!),
    enabled: !!modelId,
  });
}
