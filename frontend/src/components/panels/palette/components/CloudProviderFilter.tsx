"use client";

/**
 * CloudProviderFilter - Toggle bar to filter palette by cloud provider.
 *
 * Uses ScrollableTabs for consistent styling and scroll arrows when needed.
 */

import { ScrollableTabs } from "@/components/ui/scrollable-tabs";

export type CloudFilter = "none" | "all" | "aws" | "gcp" | "azure";

interface CloudProviderFilterProps {
  value: CloudFilter;
  onChange: (filter: CloudFilter) => void;
}

const filters = [
  { key: "none", label: "Standard" },
  { key: "all", label: "All" },
  { key: "aws", label: "AWS" },
  { key: "gcp", label: "GCP" },
  { key: "azure", label: "Azure" },
];

export function CloudProviderFilter({
  value,
  onChange,
}: CloudProviderFilterProps) {
  return (
    <ScrollableTabs
      tabs={filters}
      activeTab={value}
      onTabChange={(key) => onChange(key as CloudFilter)}
      ariaLabel="Cloud provider filter"
      ariaControls="palette-content"
    />
  );
}
