"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchScimConfig,
  rotateScimToken,
  revokeScimToken,
} from "../services/scim-api";

export function useScimSettings(orgId: string) {
  const queryClient = useQueryClient();
  const [newToken, setNewToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["scim-config", orgId],
    queryFn: () => fetchScimConfig(orgId),
  });

  const rotateMutation = useMutation({
    mutationFn: () => rotateScimToken(orgId),
    onSuccess: (data) => {
      setNewToken(data.token);
      setShowToken(true);
      queryClient.invalidateQueries({ queryKey: ["scim-config", orgId] });
      toast.success(
        "SCIM token generated — save it now, it won't be shown again.",
      );
    },
    onError: () => toast.error("Failed to generate SCIM token"),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeScimToken(orgId),
    onSuccess: () => {
      setNewToken(null);
      queryClient.invalidateQueries({ queryKey: ["scim-config", orgId] });
      toast.success("SCIM token revoked");
    },
    onError: () => toast.error("Failed to revoke token"),
  });

  return {
    config,
    isLoading,
    newToken,
    showToken,
    setShowToken,
    rotateMutation,
    revokeMutation,
  };
}
