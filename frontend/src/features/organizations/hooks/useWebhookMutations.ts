import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";

interface WebhookMutationCallbacks {
  onCreateSuccess: () => void;
  onUpdateSuccess: () => void;
  onDeleteSuccess: () => void;
}

export function useWebhookMutations(
  orgId: string,
  {
    onCreateSuccess,
    onUpdateSuccess,
    onDeleteSuccess,
  }: WebhookMutationCallbacks,
) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["webhooks", orgId] });

  const create = useMutation({
    mutationFn: (data: {
      name: string;
      url: string;
      events: string[];
      secret?: string;
    }) => apiPost(`/api/organizations/${orgId}/webhooks`, data),
    onSuccess: () => {
      invalidate();
      onCreateSuccess();
      toast.success("Webhook created");
    },
    onError: (error: Error) =>
      toast.error("Failed to create webhook", { description: error.message }),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        name: string;
        url: string;
        events: string[];
        secret: string;
        isActive: boolean;
      }>;
    }) => apiPatch(`/api/organizations/${orgId}/webhooks/${id}`, data),
    onSuccess: () => {
      invalidate();
      onUpdateSuccess();
      toast.success("Webhook updated");
    },
    onError: (error: Error) =>
      toast.error("Failed to update webhook", { description: error.message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/api/organizations/${orgId}/webhooks/${id}`),
    onSuccess: () => {
      invalidate();
      onDeleteSuccess();
      toast.success("Webhook deleted");
    },
    onError: () => toast.error("Failed to delete webhook"),
  });

  const test = useMutation({
    mutationFn: (id: string) =>
      apiPost(`/api/organizations/${orgId}/webhooks/${id}/test`) as Promise<{
        success: boolean;
        statusCode?: number;
        message?: string;
      }>,
    onSuccess: (data) => {
      invalidate();
      if (data.success) {
        toast.success("Test delivery successful", {
          description: `Status: ${data.statusCode}`,
        });
      } else {
        toast.error("Test delivery failed", { description: data.message });
      }
    },
    onError: () => toast.error("Failed to test webhook"),
  });

  return { create, update, remove, test };
}
