"use client";

import { Plus, AlertCircle } from "lucide-react";
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

interface Library {
  id: string;
  name: string;
  templateCount?: number;
}

interface TemplateLibrarySelectorProps {
  libraries: Library[];
  isLoading: boolean;
  selectedLibraryId: string;
  onSelectLibrary: (id: string) => void;
  showNewLibrary: boolean;
  onToggleNewLibrary: (show: boolean) => void;
  newLibraryName: string;
  onNewLibraryNameChange: (v: string) => void;
  onCreateLibrary: () => void;
  isCreating: boolean;
}

export function TemplateLibrarySelector({
  libraries,
  isLoading,
  selectedLibraryId,
  onSelectLibrary,
  showNewLibrary,
  onToggleNewLibrary,
  newLibraryName,
  onNewLibraryNameChange,
  onCreateLibrary,
  isCreating,
}: TemplateLibrarySelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Target Library</Label>
      {isLoading ? (
        <div className="h-10 bg-muted animate-pulse rounded" />
      ) : libraries.length === 0 ? (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                No custom libraries
              </p>
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                Create a library to save templates.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <Select value={selectedLibraryId} onValueChange={onSelectLibrary}>
          <SelectTrigger>
            <SelectValue placeholder="Select library..." />
          </SelectTrigger>
          <SelectContent>
            {libraries.map((lib) => (
              <SelectItem key={lib.id} value={lib.id}>
                {lib.name} ({lib.templateCount || 0} templates)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {!showNewLibrary ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onToggleNewLibrary(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          New Library
        </Button>
      ) : (
        <div className="flex gap-2">
          <Input
            value={newLibraryName}
            onChange={(e) => onNewLibraryNameChange(e.target.value)}
            placeholder="Library name..."
            className="flex-1"
          />
          <Button size="sm" onClick={onCreateLibrary} disabled={isCreating}>
            Create
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onToggleNewLibrary(false);
              onNewLibraryNameChange("");
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
