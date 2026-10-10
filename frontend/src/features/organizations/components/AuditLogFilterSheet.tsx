"use client";

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Filter } from "lucide-react";

const RESOURCE_TYPES = [
  { value: "", label: "All Resources" },
  { value: "THREAT_MODEL", label: "Threat Models" },
  { value: "PROJECT", label: "Projects" },
  { value: "ORGANIZATION", label: "Organization" },
  { value: "THREAT", label: "Threats" },
  { value: "MITIGATION", label: "Mitigations" },
  { value: "USER", label: "Users" },
];

const ACTIONS = [
  { value: "", label: "All Actions" },
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
  { value: "VIEW", label: "View" },
  { value: "EXPORT", label: "Export" },
  { value: "SHARE", label: "Share" },
  { value: "INVITE", label: "Invite" },
];

interface AuditLogFilterSheetProps {
  action: string;
  resourceType: string;
  startDate: string;
  endDate: string;
  onActionChange: (v: string) => void;
  onResourceTypeChange: (v: string) => void;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onClear: () => void;
}

export function AuditLogFilterSheet({
  action,
  resourceType,
  startDate,
  endDate,
  onActionChange,
  onResourceTypeChange,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: AuditLogFilterSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-1" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter Logs</SheetTitle>
          <SheetDescription>
            Narrow down audit logs by criteria
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label>Action Type</Label>
            <Select value={action} onValueChange={onActionChange}>
              <SelectTrigger>
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Resource Type</Label>
            <Select value={resourceType} onValueChange={onResourceTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="All Resources" />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
            />
          </div>

          <Button variant="outline" className="w-full" onClick={onClear}>
            Clear Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
