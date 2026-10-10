"use client";

import { Filter, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditLogFiltersProps {
  entityType: string;
  action: string;
  startDate: string;
  endDate: string;
  onEntityTypeChange: (v: string) => void;
  onActionChange: (v: string) => void;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onClear: () => void;
}

export function AuditLogFilters({
  entityType,
  action,
  startDate,
  endDate,
  onEntityTypeChange,
  onActionChange,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: AuditLogFiltersProps) {
  const hasFilters = !!(entityType || action || startDate || endDate);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filter:</span>
      </div>
      <Select
        value={entityType || "all"}
        onValueChange={(v) => onEntityTypeChange(v === "all" ? "" : v)}
      >
        <SelectTrigger className="w-40 h-8 text-sm">
          <SelectValue placeholder="Entity Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Entities</SelectItem>
          <SelectItem value="USER">User</SelectItem>
          <SelectItem value="ORGANIZATION">Organization</SelectItem>
          <SelectItem value="PROJECT">Project</SelectItem>
          <SelectItem value="THREAT_MODEL">Threat Model</SelectItem>
          <SelectItem value="THREAT">Threat</SelectItem>
          <SelectItem value="MITIGATION">Mitigation</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={action || "all"}
        onValueChange={(v) => onActionChange(v === "all" ? "" : v)}
      >
        <SelectTrigger className="w-40 h-8 text-sm">
          <SelectValue placeholder="Action" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Actions</SelectItem>
          <SelectItem value="CREATE">Create</SelectItem>
          <SelectItem value="UPDATE">Update</SelectItem>
          <SelectItem value="DELETE">Delete</SelectItem>
          <SelectItem value="LOGIN">Login</SelectItem>
          <SelectItem value="LOGOUT">Logout</SelectItem>
          <SelectItem value="INVITE">Invite</SelectItem>
          <SelectItem value="ROLE_CHANGE">Role Change</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="h-8 w-36 text-sm"
          placeholder="From"
          aria-label="Start date"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="h-8 w-36 text-sm"
          placeholder="To"
          aria-label="End date"
        />
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8" onClick={onClear}>
          Clear
        </Button>
      )}
    </div>
  );
}
