/**
 * Dialog for inviting/adding members to organization
 */
"use client";

import { useState } from "react";
import { Copy, Check, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInviteMember } from "../hooks/useOrganization";
import { MEMBER_ROLES, canAssignRole, type MemberRole } from "../types";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  orgId: string;
  currentUserRole: MemberRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface InviteResult {
  success: boolean;
  message: string;
  inviteLink?: string;
  addedDirectly?: boolean;
  note?: string;
}

export function InviteMemberDialog({
  orgId,
  currentUserRole,
  open,
  onOpenChange,
}: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("VIEWER");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteMutation = useInviteMember(orgId);

  // Filter roles: exclude OWNER (can't invite as owner) and only show roles user can assign
  const availableRoles = MEMBER_ROLES.filter(
    (r) => r.value !== "OWNER" && canAssignRole(currentUserRole, r.value),
  );

  function resetForm() {
    setEmail("");
    setRole("VIEWER");
    setError(null);
    setResult(null);
    setCopied(false);
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    try {
      const response = await inviteMutation.mutateAsync({
        email: email.trim(),
        role,
      });
      setResult(response as InviteResult);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to invite member"));
    }
  }

  async function copyInviteLink() {
    if (result?.inviteLink) {
      await navigator.clipboard.writeText(result.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>
            Add a team member to your organization by email address.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <UserPlus className="h-5 w-5" />
              <span className="font-medium">{result.message}</span>
            </div>

            {result.inviteLink && !result.addedDirectly && (
              <div className="space-y-2">
                <Label>Invitation Link</Label>
                <p className="text-sm text-muted-foreground">
                  {result.note ||
                    "Share this link with the person you invited:"}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={result.inviteLink}
                    readOnly
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyInviteLink}
                    aria-label="Copy invite link"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Add Another
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={inviteMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as MemberRole)}
                disabled={inviteMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex flex-col">
                        <span>{r.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={inviteMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Adding..." : "Add Member"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
