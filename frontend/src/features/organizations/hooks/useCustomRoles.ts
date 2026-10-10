import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";

export interface Permission {
  id: string;
  category: string;
  label: string;
  description: string;
}

export interface PermissionPreset {
  name: string;
  permissions: string[];
}

export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  permissions: string[];
  isSystem: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionsResponse {
  permissions: Permission[];
  presets: PermissionPreset[];
}

function fetchRoles(orgId: string): Promise<CustomRole[]> {
  return apiGet(`/api/organizations/${orgId}/roles`);
}

function fetchPermissions(): Promise<PermissionsResponse> {
  return apiGet("/api/permissions");
}

export function useCustomRoles(orgId: string) {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [deletingRole, setDeletingRole] = useState<CustomRole | null>(null);

  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["custom-roles", orgId],
    queryFn: () => fetchRoles(orgId),
    enabled: !!orgId,
  });

  const { data: permissionsData, isLoading: isLoadingPermissions } = useQuery({
    queryKey: ["permissions"],
    queryFn: fetchPermissions,
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      permissions: string[];
    }) => apiPost(`/api/organizations/${orgId}/roles`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles", orgId] });
      toast.success("Custom role created");
      setShowCreateDialog(false);
    },
    onError: (error: Error) => {
      toast.error("Failed to create role", { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      roleId,
      data,
    }: {
      roleId: string;
      data: { name?: string; description?: string; permissions?: string[] };
    }) => apiPut(`/api/organizations/${orgId}/roles/${roleId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles", orgId] });
      toast.success("Custom role updated");
      setEditingRole(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to update role", { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) =>
      apiDelete(`/api/organizations/${orgId}/roles/${roleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles", orgId] });
      toast.success("Custom role deleted");
      setDeletingRole(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to delete role", { description: error.message });
    },
  });

  function handleSave(formData: {
    name: string;
    description?: string;
    permissions: string[];
  }) {
    if (editingRole) {
      updateMutation.mutate({ roleId: editingRole.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  return {
    roles,
    isLoading: isLoadingRoles || isLoadingPermissions,
    permissionsData,
    showCreateDialog,
    setShowCreateDialog,
    editingRole,
    setEditingRole,
    deletingRole,
    setDeletingRole,
    createMutation,
    updateMutation,
    deleteMutation,
    handleSave,
  };
}
