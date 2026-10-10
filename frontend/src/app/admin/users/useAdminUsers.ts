"use client";

import { useState } from "react";
import {
  useInviteUser,
  useUpdateUser,
  useOrganizations,
  useAddMembership,
  useUpdateMembership,
  useRemoveMembership,
} from "@/features/admin";
import type { AdminUser, MemberRole } from "@/features/admin";

export interface RemoveConfirm {
  membershipId: string;
  orgName: string;
}

export function useAdminUsers() {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("VIEWER");
  const [inviteOrgId, setInviteOrgId] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editIsSuperAdmin, setEditIsSuperAdmin] = useState(false);
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [newOrgId, setNewOrgId] = useState("");
  const [newOrgRole, setNewOrgRole] = useState<MemberRole>("VIEWER");
  const [removeConfirm, setRemoveConfirm] = useState<RemoveConfirm | null>(
    null,
  );

  const inviteUser = useInviteUser();
  const updateUser = useUpdateUser();
  const addMembership = useAddMembership();
  const updateMembership = useUpdateMembership();
  const removeMembership = useRemoveMembership();
  const { data: orgsData } = useOrganizations({ limit: 100 });

  const handleInvite = async () => {
    if (!inviteEmail || !inviteOrgId) return;
    await inviteUser.mutateAsync({
      email: inviteEmail,
      role: inviteRole,
      organizationId: inviteOrgId,
    });
    setInviteEmail("");
    setInviteRole("VIEWER");
    setInviteOrgId("");
    setIsInviteOpen(false);
  };

  const handleUserSelect = (user: AdminUser) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditIsSuperAdmin(user.isSuperAdmin);
    setShowAddOrg(false);
    setNewOrgId("");
    setNewOrgRole("VIEWER");
    setIsEditOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser || !editName.trim()) return;
    await updateUser.mutateAsync({
      userId: selectedUser.id,
      data: { name: editName.trim(), isSuperAdmin: editIsSuperAdmin },
    });
    setIsEditOpen(false);
    setSelectedUser(null);
  };

  const handleRoleChange = async (
    membershipId: string,
    newRole: MemberRole,
  ) => {
    if (!selectedUser) return;
    await updateMembership.mutateAsync({
      userId: selectedUser.id,
      membershipId,
      data: { role: newRole },
    });
    setSelectedUser({
      ...selectedUser,
      memberships: selectedUser.memberships.map((m) =>
        m.id === membershipId ? { ...m, role: newRole } : m,
      ),
    });
  };

  const handleAddToOrg = async () => {
    if (!selectedUser || !newOrgId) return;
    const result = await addMembership.mutateAsync({
      userId: selectedUser.id,
      data: { organizationId: newOrgId, role: newOrgRole },
    });
    setSelectedUser({
      ...selectedUser,
      memberships: [...selectedUser.memberships, result],
    });
    setShowAddOrg(false);
    setNewOrgId("");
    setNewOrgRole("VIEWER");
  };

  const handleRemoveFromOrg = async () => {
    if (!selectedUser || !removeConfirm) return;
    await removeMembership.mutateAsync({
      userId: selectedUser.id,
      membershipId: removeConfirm.membershipId,
    });
    setSelectedUser({
      ...selectedUser,
      memberships: selectedUser.memberships.filter(
        (m) => m.id !== removeConfirm.membershipId,
      ),
    });
    setRemoveConfirm(null);
  };

  const availableOrgs =
    orgsData?.organizations?.filter(
      (org) =>
        !selectedUser?.memberships?.some((m) => m.organizationId === org.id),
    ) ?? [];

  return {
    isInviteOpen,
    setIsInviteOpen,
    isEditOpen,
    setIsEditOpen,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    inviteOrgId,
    setInviteOrgId,
    selectedUser,
    editName,
    setEditName,
    editIsSuperAdmin,
    setEditIsSuperAdmin,
    showAddOrg,
    setShowAddOrg,
    newOrgId,
    setNewOrgId,
    newOrgRole,
    setNewOrgRole,
    removeConfirm,
    setRemoveConfirm,
    orgsData,
    availableOrgs,
    inviteUser,
    updateUser,
    addMembership,
    handleInvite,
    handleUserSelect,
    handleUpdateUser,
    handleRoleChange,
    handleAddToOrg,
    handleRemoveFromOrg,
  };
}
