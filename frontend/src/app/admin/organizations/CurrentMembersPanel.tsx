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
import { Search, ChevronLeft } from "lucide-react";
import type { MemberRole } from "@/features/admin";

const ROLES: { value: MemberRole; label: string }[] = [
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Admin" },
  { value: "EDITOR", label: "Editor" },
  { value: "VIEWER", label: "Viewer" },
];

interface Member {
  id: string;
  userName?: string | null;
  userEmail?: string | null;
  role: MemberRole;
}

interface CurrentMembersPanelProps {
  members: Member[];
  totalCount: number;
  selectedToRemove: Set<string>;
  search: string;
  isProcessing: boolean;
  onSearchChange: (v: string) => void;
  onToggleSelectAll: () => void;
  onToggleMember: (id: string) => void;
  onRoleChange: (memberId: string, role: MemberRole) => void;
  onRequestRemove: () => void;
}

export function CurrentMembersPanel({
  members,
  totalCount,
  selectedToRemove,
  search,
  isProcessing,
  onSearchChange,
  onToggleSelectAll,
  onToggleMember,
  onRoleChange,
  onRequestRemove,
}: CurrentMembersPanelProps) {
  return (
    <div className="border rounded-lg flex flex-col">
      <div className="p-3 border-b bg-muted/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm">Current Members</h3>
          <Badge variant="secondary">{totalCount}</Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
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
              members.length > 0 && selectedToRemove.size === members.length
            }
            onCheckedChange={onToggleSelectAll}
          />
          <span className="text-muted-foreground">
            {selectedToRemove.size > 0
              ? `${selectedToRemove.size} selected`
              : "Select all"}
          </span>
        </label>
      </div>

      <ScrollArea className="flex-1 h-[280px]">
        {members.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {search ? "No matching members" : "No members yet"}
          </div>
        ) : (
          <div className="divide-y">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selectedToRemove.has(member.id)}
                  onCheckedChange={() => onToggleMember(member.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {member.userName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {member.userEmail}
                  </div>
                </div>
                <Select
                  value={member.role}
                  onValueChange={(v) =>
                    onRoleChange(member.id, v as MemberRole)
                  }
                >
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem
                        key={r.value}
                        value={r.value}
                        className="text-xs"
                      >
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t bg-muted/30">
        <Button
          onClick={onRequestRemove}
          disabled={selectedToRemove.size === 0 || isProcessing}
          variant="destructive"
          className="w-full"
          size="sm"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Remove {selectedToRemove.size > 0 ? `(${selectedToRemove.size})` : ""}
        </Button>
      </div>
    </div>
  );
}
