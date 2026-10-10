"use client";

import { useState } from "react";
import {
  useOrganizationWithMembers,
  useAddOrgMember,
  useUpdateOrgMemberRole,
  useRemoveOrgMember,
  useUsers,
} from "@/features/admin";
import type { MemberRole } from "@/features/admin";

export function useManageMembers(orgId: string) {
  const { data: org, isLoading } = useOrganizationWithMembers(orgId);
  const { data: usersData } = useUsers({ limit: 100 });
  const addMember = useAddOrgMember();
  const updateRole = useUpdateOrgMemberRole();
  const removeMember = useRemoveOrgMember();

  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [selectedToRemove, setSelectedToRemove] = useState<Set<string>>(
    new Set(),
  );
  const [addRole, setAddRole] = useState<MemberRole>("VIEWER");
  const [searchAvailable, setSearchAvailable] = useState("");
  const [searchMembers, setSearchMembers] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const availableUsers = (
    usersData?.users?.filter(
      (u) => !org?.members?.some((m) => m.userId === u.id),
    ) || []
  ).filter(
    (u) =>
      u.name?.toLowerCase().includes(searchAvailable.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchAvailable.toLowerCase()),
  );

  const filteredMembers = (org?.members || []).filter(
    (m) =>
      m.userName?.toLowerCase().includes(searchMembers.toLowerCase()) ||
      m.userEmail?.toLowerCase().includes(searchMembers.toLowerCase()),
  );

  const toggleAddSelection = (userId: string) => {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const toggleRemoveSelection = (memberId: string) => {
    setSelectedToRemove((prev) => {
      const next = new Set(prev);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  };

  const toggleSelectAllAvailable = () => {
    setSelectedToAdd(
      selectedToAdd.size === availableUsers.length
        ? new Set()
        : new Set(availableUsers.map((u) => u.id)),
    );
  };

  const toggleSelectAllMembers = () => {
    setSelectedToRemove(
      selectedToRemove.size === filteredMembers.length
        ? new Set()
        : new Set(filteredMembers.map((m) => m.id)),
    );
  };

  const handleBulkAdd = async () => {
    if (selectedToAdd.size === 0) return;
    setIsProcessing(true);
    try {
      for (const userId of selectedToAdd) {
        await addMember.mutateAsync({ orgId, data: { userId, role: addRole } });
      }
      setSelectedToAdd(new Set());
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkRemove = async () => {
    if (selectedToRemove.size === 0) return;
    setIsProcessing(true);
    try {
      for (const memberId of selectedToRemove) {
        await removeMember.mutateAsync({ orgId, memberId });
      }
      setSelectedToRemove(new Set());
      setConfirmRemove(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: MemberRole) => {
    await updateRole.mutateAsync({ orgId, memberId, role });
  };

  return {
    org,
    isLoading,
    addMemberIsPending: addMember.isPending,
    selectedToAdd,
    selectedToRemove,
    addRole,
    setAddRole,
    searchAvailable,
    setSearchAvailable,
    searchMembers,
    setSearchMembers,
    isProcessing,
    confirmRemove,
    setConfirmRemove,
    availableUsers,
    filteredMembers,
    toggleAddSelection,
    toggleRemoveSelection,
    toggleSelectAllAvailable,
    toggleSelectAllMembers,
    handleBulkAdd,
    handleBulkRemove,
    handleRoleChange,
  };
}
