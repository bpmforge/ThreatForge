/**
 * UsersTable - Display and manage users
 */
"use client";

import { DeleteConfirmDialog } from "@/components/dialogs/DeleteAlertDialog";
import { PaginationFooter } from "@/components/PaginationFooter";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Search,
  Trash2,
  Mail,
  UserCog,
  Shield,
  Upload,
} from "lucide-react";
import { useUsers, useDeleteUser } from "../hooks/useAdmin";
import { BulkImportDialog } from "./BulkImportDialog";
import type { AdminUser, MemberRole } from "../types";

interface UsersTableProps {
  onUserSelect?: (user: AdminUser) => void;
}

const roleColors: Record<MemberRole, string> = {
  OWNER: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  ADMIN: "bg-primary/10 text-primary",
  EDITOR: "bg-green-500/10 text-green-600 dark:text-green-400",
  VIEWER: "bg-muted text-muted-foreground",
};

export function UsersTable({ onUserSelect }: UsersTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const limit = 10;

  const { data, isLoading, error } = useUsers({ search, page, limit });
  const deleteUser = useDeleteUser();

  const handleDeleteClick = (userId: string, userName: string) => {
    setDeleteConfirm({ id: userId, name: userName });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    await deleteUser.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        Failed to load users: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Button variant="outline">
          <Mail className="h-4 w-4 mr-2" />
          Invite User
        </Button>
        <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Bulk Import
        </Button>
      </div>

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
      />

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : data?.users?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              data?.users?.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onUserSelect?.(user)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                        {user.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.name}</span>
                        {user.isSuperAdmin && (
                          <span title="Super Admin">
                            <Shield className="h-4 w-4 text-amber-600" />
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.memberships.slice(0, 2).map((m) => (
                        <Badge key={m.id} className={roleColors[m.role]}>
                          {m.role.toLowerCase()}
                        </Badge>
                      ))}
                      {user.memberships.length > 2 && (
                        <Badge variant="secondary">
                          +{user.memberships.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.lastLoginAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onUserSelect?.(user)}>
                          <UserCog className="h-4 w-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(user.id, user.name);
                          }}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.total > limit && (
        <PaginationFooter
          page={page}
          limit={limit}
          total={data.total}
          noun="users"
          onPageChange={setPage}
        />
      )}

      {/* Delete User Confirmation */}
      <DeleteConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete User?"
        name={deleteConfirm?.name}
      />
    </div>
  );
}
