"use client";

/**
 * SecurityContextFields
 *
 * The form sections of the Security Context panel: data classification,
 * data types, access pattern, compliance frameworks, existing controls,
 * and technology version.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { SecurityChipGroup } from "./SecurityChipGroup";
import {
  type SecurityContext,
  DATA_TYPES,
  COMPLIANCE_FRAMEWORKS,
  EXISTING_CONTROLS,
  CLASSIFICATION_COLORS,
} from "./security-context-data";

interface SecurityContextFieldsProps {
  value: SecurityContext;
  onChange: (ctx: SecurityContext) => void;
  toggle: (
    field: "dataTypes" | "complianceFrameworks" | "existingControls",
    item: string,
  ) => void;
}

export function SecurityContextFields({
  value,
  onChange,
  toggle,
}: SecurityContextFieldsProps) {
  return (
    <>
      {/* Data Classification */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Data Classification
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as const).map(
            (level) => (
              <Button
                key={level}
                variant="outline"
                size="sm"
                onClick={() =>
                  onChange({ ...value, dataClassification: level })
                }
                className={`text-xs px-2 py-1.5 h-auto ${
                  value.dataClassification === level
                    ? CLASSIFICATION_COLORS[level] +
                      " border-current font-medium"
                    : ""
                }`}
              >
                {level}
              </Button>
            ),
          )}
        </div>
      </div>

      {/* Data Types */}
      <SecurityChipGroup
        label="Data Types"
        options={DATA_TYPES}
        selected={value.dataTypes}
        onToggle={(item) => toggle("dataTypes", item)}
      />

      {/* Access Pattern */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Access Pattern
        </label>
        <Select
          value={value.accessPattern}
          onValueChange={(val) =>
            onChange({
              ...value,
              accessPattern: val as SecurityContext["accessPattern"],
            })
          }
        >
          <SelectTrigger className="w-full text-xs h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PUBLIC_INTERNET">Public Internet</SelectItem>
            <SelectItem value="AUTHENTICATED_USERS">
              Authenticated Users
            </SelectItem>
            <SelectItem value="INTERNAL_ONLY">Internal Only</SelectItem>
            <SelectItem value="PARTNER_API">Partner API</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Compliance Frameworks */}
      <SecurityChipGroup
        label="Compliance Requirements"
        options={COMPLIANCE_FRAMEWORKS}
        selected={value.complianceFrameworks}
        onToggle={(item) => toggle("complianceFrameworks", item)}
      />

      {/* Existing Controls */}
      <SecurityChipGroup
        label="Existing Controls"
        options={EXISTING_CONTROLS}
        selected={value.existingControls}
        onToggle={(item) => toggle("existingControls", item)}
        selectedClassName="bg-green-600 text-white border-green-600 hover:bg-green-600/90"
      />

      {/* Technology Version */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Technology / Version (optional)
        </label>
        <Input
          type="text"
          placeholder="e.g., PostgreSQL 17, Node.js 22"
          value={value.technologyVersion || ""}
          onChange={(e) =>
            onChange({ ...value, technologyVersion: e.target.value })
          }
          className="text-xs h-8"
        />
      </div>
    </>
  );
}
