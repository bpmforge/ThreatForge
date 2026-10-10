"use client";

/**
 * AssigneePicker - Select or clear the assignee for a threat.
 *
 * Renders a shadcn Select populated from org membership.
 * Calls onChange when the selection changes.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/features/organizations/hooks/useOrganization";
import type { ThreatAssignee } from "../types";

interface AssigneePickerProps {
  orgId: string | undefined;
  value: string | null | undefined;
  assignee?: ThreatAssignee | null;
  onChange: (assigneeId: string | null) => void;
  disabled?: boolean;
}

const UNASSIGNED = "__none__";

export function AssigneePicker({
  orgId,
  value,
  assignee,
  onChange,
  disabled,
}: AssigneePickerProps) {
  const { data: org } = useOrganization(orgId);
  const members = org?.memberships ?? [];

  const displayValue = value ?? UNASSIGNED;

  const handleChange = (val: string) => {
    onChange(val === UNASSIGNED ? null : val);
  };

  return (
    <Select
      value={displayValue}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 text-xs w-full" aria-label="Assignee">
        <SelectValue placeholder="Unassigned">
          {value && assignee ? assignee.name : "Unassigned"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED} className="text-xs">
          Unassigned
        </SelectItem>
        {members.map((m) => (
          <SelectItem key={m.userId} value={m.userId} className="text-xs">
            {m.user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
