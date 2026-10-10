"use client";

/**
 * Pieces shared by the CVSS 3.1 and CVSS 4.0 score panels.
 */
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "NONE":
      return "bg-gray-400";
    case "LOW":
      return "bg-blue-500";
    case "MEDIUM":
      return "bg-yellow-500";
    case "HIGH":
      return "bg-orange-500";
    case "CRITICAL":
      return "bg-red-600";
    default:
      return "bg-gray-400";
  }
}

interface CVSSScoreHeaderProps {
  title: string;
  baseScore: number;
  severity: string;
}

export function CVSSScoreHeader({
  title,
  baseScore,
  severity,
}: CVSSScoreHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm font-medium">{title}</Label>
      <div className="flex items-center gap-2">
        <span
          className={`px-2 py-0.5 rounded text-xs text-white font-medium ${getSeverityColor(severity)}`}
        >
          {baseScore}
        </span>
        <span className="text-xs text-muted-foreground">{severity}</span>
      </div>
    </div>
  );
}

interface CVSSVectorFooterProps {
  vectorString: string;
  summary: string;
}

export function CVSSVectorFooter({
  vectorString,
  summary,
}: CVSSVectorFooterProps) {
  return (
    <>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Vector String</Label>
        <code className="block text-[10px] bg-muted p-1 rounded break-all">
          {vectorString}
        </code>
      </div>

      <p className="text-xs text-muted-foreground italic">{summary}</p>
    </>
  );
}

interface MetricSelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly {
    value: T;
    label: string;
    short: string;
    description: string;
  }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function MetricSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: MetricSelectProps<T>) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <div className="flex flex-col">
                <span>{opt.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {opt.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
