/**
 * "Sign out everywhere": the server rejects every token issued before now,
 * including this browser's, so sign out locally afterwards.
 */
import { useMutation } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";

export function useRevokeAllSessions() {
  return useMutation({
    mutationFn: () => apiPost<unknown>(`/api/users/me/sessions/revoke-all`, {}),
    onSuccess: () => {
      void signOut({ callbackUrl: "/login" });
    },
    onError: (error: Error) => {
      toast.error("Failed to sign out everywhere", {
        description: error.message,
      });
    },
  });
}
