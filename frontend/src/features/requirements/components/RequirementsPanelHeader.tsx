"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Upload,
  Shield,
  ChevronDown,
  Search,
  Sparkles,
} from "lucide-react";

interface RequirementsPanelHeaderProps {
  totalCount: number;
  covered: number;
  coveragePct: number;
  pendingCount: number;
  sourceFilter: string;
  search: string;
  onSourceFilterChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  onAddManual: () => void;
  onAddCsv: () => void;
  onAddFramework: () => void;
}

export function RequirementsPanelHeader({
  totalCount,
  covered,
  coveragePct,
  pendingCount,
  sourceFilter,
  search,
  onSourceFilterChange,
  onSearchChange,
  onAddManual,
  onAddCsv,
  onAddFramework,
}: RequirementsPanelHeaderProps) {
  return (
    <div className="p-3 border-b space-y-2 shrink-0">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Requirements</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onAddManual}>
              <Plus className="h-3.5 w-3.5 mr-2" />
              Add Manually
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddCsv}>
              <Upload className="h-3.5 w-3.5 mr-2" />
              Import CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddFramework}>
              <Shield className="h-3.5 w-3.5 mr-2" />
              Import Framework
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {totalCount > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {covered}/{totalCount} covered
            </span>
            <span>{coveragePct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${coveragePct}%` }}
            />
          </div>
        </div>
      )}

      {pendingCount > 0 && (
        <button
          type="button"
          onClick={() => onSourceFilterChange("AI_SUGGESTED")}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded border border-yellow-300 bg-yellow-50 text-yellow-900 text-xs hover:bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200 dark:hover:bg-yellow-900"
          aria-label={`${pendingCount} AI-suggested requirements awaiting review`}
        >
          <Sparkles className="h-3 w-3 shrink-0" />
          <span className="flex-1 text-left">
            {pendingCount} AI suggestion{pendingCount !== 1 ? "s" : ""} awaiting
            review
          </span>
          <span className="text-yellow-700 dark:text-yellow-400">→</span>
        </button>
      )}

      <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="All sources" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          <SelectItem value="MANUAL">Manual</SelectItem>
          <SelectItem value="DOCUMENT">Document</SelectItem>
          <SelectItem value="CSV">CSV</SelectItem>
          <SelectItem value="FRAMEWORK">Framework</SelectItem>
          <SelectItem value="AI_SUGGESTED">AI Suggested</SelectItem>
        </SelectContent>
      </Select>

      {totalCount > 5 && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter requirements..."
            className="h-7 text-xs pl-7"
            aria-label="Filter requirements"
          />
        </div>
      )}
    </div>
  );
}
