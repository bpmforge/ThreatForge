/**
 * Admin Organizations Page
 *
 * Organization management for administrators.
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Search,
  Building2,
  Users,
  Trash2,
  Pencil,
  UserPlus,
} from "lucide-react";
import { useOrganizations, useDeleteOrganization } from "@/features/admin";
import type { AdminOrganization } from "@/features/admin";
import { EditOrganizationDialog } from "./EditOrganizationDialog";
import { ManageMembersDialog } from "./ManageMembersDialog";

export default function AdminOrganizationsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editOrgId, setEditOrgId] = useState<string | null>(null);
  const [manageMembersOrgId, setManageMembersOrgId] = useState<string | null>(
    null,
  );
  const limit = 10;

  const { data, isLoading, error } = useOrganizations({ search, page, limit });
  const deleteOrg = useDeleteOrganization();

  const handleDeleteClick = (orgId: string, orgName: string) => {
    setDeleteConfirm({ id: orgId, name: orgName });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    await deleteOrg.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        Failed to load organizations: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage organization accounts
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading organizations...
                </TableCell>
              </TableRow>
            ) : data?.organizations?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  No organizations found
                </TableCell>
              </TableRow>
            ) : (
              data?.organizations?.map((org: AdminOrganization) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{org.name}</div>
                        {org.slug && (
                          <div className="text-xs text-muted-foreground">
                            @{org.slug}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {org.owner ? (
                      <div>
                        <div className="text-sm">{org.owner.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {org.owner.email}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No owner</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{org.memberCount}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {org.projectCount} projects
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(org.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditOrgId(org.id)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setManageMembersOrgId(org.id)}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Manage Members
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(org.id, org.name)}
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
          noun="organizations"
          onPageChange={setPage}
        />
      )}

      {/* Edit Organization Dialog */}
      {editOrgId && (
        <EditOrganizationDialog
          orgId={editOrgId}
          onClose={() => setEditOrgId(null)}
        />
      )}

      {/* Manage Members Dialog */}
      {manageMembersOrgId && (
        <ManageMembersDialog
          orgId={manageMembersOrgId}
          onClose={() => setManageMembersOrgId(null)}
        />
      )}

      {/* Delete Organization Confirmation */}
      <DeleteConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Organization?"
        name={deleteConfirm?.name}
        warning="This will remove all projects and data. This action cannot be undone."
      />
    </div>
  );
}
