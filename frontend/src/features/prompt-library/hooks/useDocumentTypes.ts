/**
 * useDocumentTypes Hook - Manage document type configurations
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "../services/api";

const DOC_TYPES_KEY = "documentTypes";

export function useDocumentTypes(orgId: string | undefined) {
  return useQuery({
    queryKey: [DOC_TYPES_KEY, orgId],
    queryFn: () => (orgId ? api.getDocumentTypes(orgId) : Promise.resolve([])),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDeleteDocumentType(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (docTypeId: string) => api.deleteDocumentType(orgId, docTypeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOC_TYPES_KEY, orgId] });
      toast.success("Document type deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete document type: ${error.message}`);
    },
  });
}
