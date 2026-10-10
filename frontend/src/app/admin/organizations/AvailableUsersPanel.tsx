"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, ChevronRight } from "lucide-react";
import type { MemberRole } from "@/features/admin";

const ROLES: { value: MemberRole; label: string }[] = [
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Admin" },
  { value: "EDITOR", label: "Editor" },
  { value: "VIEWER", label: "Viewer" },
];

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface AvailableUsersPanelProps {
  availableUsers: User[];
  selectedToAdd: Set<string>;
  addRole: MemberRole;
  search: string;
  isProcessing: boolean;
  addMemberIsPending: boolean;
  onSearchChange: (v: string) => void;
  onToggleSelectAll: () => void;
  onToggleUser: (id: string) => void;
  onRoleChange: (role: MemberRole) => void;
  onAdd: () => void;
}

export function AvailableUsersPanel({
  availableUsers,
  selectedToAdd,
  addRole,
  search,
  isProcessing,
  addMemberIsPending,
  onSearchChange,
  onToggleSelectAll,
  onToggleUser,
  onRoleChange,
  onAdd,
}: AvailableUsersPanelProps) {
  return (
    <div className="border rounded-lg flex flex-col">
      <div className="p-3 border-b bg-muted/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm">Available Users</h3>
          <Badge variant="secondary">{availableUsers.length}</Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <div className="px-3 py-2 border-b flex items-center justify-between bg-background">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={
              availableUsers.length > 0 &&
              selectedToAdd.size === availableUsers.length
            }
            onCheckedChange={onToggleSelectAll}
          />
          <span className="text-muted-foreground">
            {selectedToAdd.size > 0
              ? `${selectedToAdd.size} selected`
              : "Select all"}
          </span>
        </label>
        <Select
          value={addRole}
          onValueChange={(v) => onRoleChange(v as MemberRole)}
        >
          <SelectTrigger className="w-24 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value} className="text-xs">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1 h-[280px]">
        {availableUsers.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {search ? "No matching users" : "No available users"}
          </div>
        ) : (
          <div className="divide-y">
            {availableUsers.map((user) => (
              <label
                key={user.id}
                className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedToAdd.has(user.id)}
                  onCheckedChange={() => onToggleUser(user.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {user.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t bg-muted/30">
        <Button
          onClick={onAdd}
          disabled={selectedToAdd.size === 0 || isProcessing}
          className="w-full"
          size="sm"
        >
          {isProcessing && addMemberIsPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <ChevronRight className="h-4 w-4 mr-2" />
              Add {selectedToAdd.size > 0
                ? `(${selectedToAdd.size})`
                : ""} as {addRole}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
