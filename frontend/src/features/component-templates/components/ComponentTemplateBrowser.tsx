/**
 * Component Template Browser
 *
 * A browsing UI for selecting component templates to use when creating
 * new components on the canvas. Supports filtering and search.
 */
"use client";

import { useState, useMemo, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Box } from "lucide-react";
import {
  useComponentTemplateLibraries,
  useComponentTemplates,
} from "../hooks/useComponentTemplates";
import type { ComponentTemplate, ComponentType } from "../types";

const COMPONENT_TYPE_OPTIONS: {
  value: ComponentType | "ALL";
  label: string;
}[] = [
  { value: "ALL", label: "All Types" },
  { value: "EXTERNAL_USER", label: "External User" },
  { value: "INTERNAL_USER", label: "Internal User" },
  { value: "EXTERNAL_SYSTEM", label: "External System" },
  { value: "SERVICE", label: "Service" },
  { value: "API", label: "API" },
  { value: "FUNCTION", label: "Function" },
  { value: "PROCESS", label: "Process" },
  { value: "DATABASE", label: "Database" },
  { value: "FILE_STORAGE", label: "File Storage" },
  { value: "CACHE", label: "Cache" },
  { value: "QUEUE", label: "Queue" },
  { value: "LOAD_BALANCER", label: "Load Balancer" },
  { value: "FIREWALL", label: "Firewall" },
  { value: "API_GATEWAY", label: "API Gateway" },
];

interface Props {
  organizationId: string;
  onSelect: (template: ComponentTemplate) => void;
  selectedTemplateId?: string;
  className?: string;
}

export function ComponentTemplateBrowser({
  organizationId,
  onSelect,
  selectedTemplateId,
  className,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<ComponentType | "ALL">(
    "ALL",
  );

  // Fetch libraries
  const { data: librariesData } = useComponentTemplateLibraries(organizationId);
  // Ensure libraries is always an array (API might return non-array data)
  const libraries = Array.isArray(librariesData) ? librariesData : [];

  // Auto-select first library when libraries load and none is selected
  useEffect(() => {
    if (libraries.length > 0 && selectedLibraryId === "all") {
      // Keep "all" as a valid option - we'll show a helpful message
    }
  }, [libraries, selectedLibraryId]);

  // Determine which library to fetch templates from
  const effectiveLibraryId =
    selectedLibraryId === "all" ? libraries[0]?.id : selectedLibraryId;

  // Fetch templates from selected library
  const { data: templatesData } = useComponentTemplates(
    organizationId,
    effectiveLibraryId,
  );
  // Ensure templates is always an array (API might return non-array data)
  const templates = Array.isArray(templatesData) ? templatesData : [];

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      // Filter by type
      if (selectedType !== "ALL" && t.componentType !== selectedType) {
        return false;
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(query);
        const matchesDesc = t.description?.toLowerCase().includes(query);
        const matchesTags = t.tags.some((tag) =>
          tag.toLowerCase().includes(query),
        );
        if (!matchesName && !matchesDesc && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }, [templates, selectedType, searchQuery]);

  return (
    <div className={className}>
      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={selectedLibraryId} onValueChange={setSelectedLibraryId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Library" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Libraries</SelectItem>
            {libraries.map((lib) => (
              <SelectItem key={lib.id} value={lib.id}>
                {lib.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedType}
          onValueChange={(v) => setSelectedType(v as ComponentType | "ALL")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {COMPONENT_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Library info when "All" is selected */}
      {selectedLibraryId === "all" && libraries.length > 0 && (
        <p className="text-xs text-muted-foreground mb-2">
          Showing templates from: {libraries[0]?.name}
        </p>
      )}

      {/* Template List */}
      <ScrollArea className="h-[400px]">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Box className="h-12 w-12 mb-2 opacity-50" />
            <p>No templates found</p>
            {searchQuery && (
              <p className="text-sm">Try adjusting your search or filters</p>
            )}
            {!searchQuery && libraries.length === 0 && (
              <p className="text-sm">Create a library first to add templates</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={template.id === selectedTemplateId}
                onClick={() => onSelect(template)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// =============================================================================
// Template Card
// =============================================================================

interface TemplateCardProps {
  template: ComponentTemplate;
  isSelected: boolean;
  onClick: () => void;
}

function TemplateCard({ template, isSelected, onClick }: TemplateCardProps) {
  return (
    <button
      type="button"
      className={`
        w-full p-3 text-left border rounded-lg transition-colors
        hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring
        ${isSelected ? "border-primary bg-primary/5" : "border-border"}
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-medium shrink-0"
          style={{ backgroundColor: template.color || "#6366f1" }}
        >
          {template.icon || template.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{template.name}</div>
          <div className="text-xs text-muted-foreground">
            {COMPONENT_TYPE_OPTIONS.find(
              (o) => o.value === template.componentType,
            )?.label ?? template.componentType}
          </div>
          {template.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {template.description}
            </p>
          )}
        </div>
      </div>

      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {template.tags.slice(0, 3).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              {tag}
            </Badge>
          ))}
          {template.tags.length > 3 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              +{template.tags.length - 3}
            </Badge>
          )}
        </div>
      )}
    </button>
  );
}
