"use client";

import { Button } from "@/components/ui/button";
import { Plus, Upload, Database } from "lucide-react";
import { LibraryManagerDialog, builtInStats } from "@/features/threat-library";
import {
  ThreatCatalogDialog,
  CustomSourceImport,
} from "@/features/threat-catalog";
import { AppHeader } from "@/components/layout";
import { useThreatLibraryPage } from "../hooks/useThreatLibraryPage";
import { ThreatLibraryFiltersBar } from "./ThreatLibraryFiltersBar";
import { ThreatLibraryTabsSection } from "./ThreatLibraryTabsSection";
import { ExternalThreatDatabasesCard } from "./ExternalThreatDatabasesCard";

export default function ThreatLibraryPage() {
  const p = useThreatLibraryPage();

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Threat Library
            </h1>
            <p className="text-muted-foreground">
              {builtInStats.total} built-in threats +{" "}
              {p.catalogStats.mitre + p.catalogStats.cwe + p.catalogStats.capec}{" "}
              searchable from external sources
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => p.setShowImport(true)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => p.setShowCatalog(true)}
            >
              <Database className="h-4 w-4 mr-2" />
              Search All
            </Button>
            <Button size="sm" onClick={() => p.setShowManager(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Manage
            </Button>
          </div>
        </div>

        <ThreatLibraryFiltersBar
          severityFilter={p.severityFilter}
          onSeverityFilter={p.setSeverityFilter}
          severityCounts={p.severityCounts}
          search={p.search}
          onSearch={p.setSearch}
          sourceFilter={p.sourceFilter}
          onSourceFilter={(v) => p.setSourceFilter(v as typeof p.sourceFilter)}
        />

        <ThreatLibraryTabsSection
          activeTab={p.activeTab}
          onTabChange={p.setActiveTab}
          filteredThreats={p.filteredThreats}
          getSourceThreats={p.getSourceThreats}
          onSelectThreat={p.handleSelectThreat}
          libraries={p.libraries}
        />

        <ExternalThreatDatabasesCard
          catalogStats={p.catalogStats}
          onSearchAll={() => p.setShowCatalog(true)}
        />

        <LibraryManagerDialog
          open={p.showManager}
          onOpenChange={p.setShowManager}
        />
        <ThreatCatalogDialog
          open={p.showCatalog}
          onOpenChange={p.setShowCatalog}
          onAddThreat={p.handleAddCatalogThreat}
        />
        <CustomSourceImport
          open={p.showImport}
          onOpenChange={p.setShowImport}
          onImport={p.handleImportCustom}
        />
      </main>
    </>
  );
}
