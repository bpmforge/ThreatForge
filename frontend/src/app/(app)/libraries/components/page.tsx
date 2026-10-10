/**
 * Component Templates Management Page
 *
 * Admin UI for managing reusable component templates.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Box, Library, Layers } from "lucide-react";
import {
  ComponentTemplateBrowser,
  ComponentTemplateManagerDialog,
  useComponentTemplateLibraries,
} from "@/features/component-templates";
import { AppHeader } from "@/components/layout";
import { useCurrentOrgId } from "@/stores/org-store";

export default function ComponentTemplatesPage() {
  const [showManager, setShowManager] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<
    string | undefined
  >();

  // Get user's current organization (convert null to undefined for type compatibility)
  const organizationId = useCurrentOrgId() ?? undefined;

  const { data: librariesData } = useComponentTemplateLibraries(organizationId);
  // Ensure libraries is always an array (API might return non-array data)
  const libraries = Array.isArray(librariesData) ? librariesData : [];

  const totalTemplates = libraries.reduce(
    (sum, lib) => sum + (lib.templateCount ?? 0),
    0,
  );

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Component Templates
            </h1>
            <p className="text-muted-foreground">
              Manage reusable component configurations for your team
            </p>
          </div>
          <Button onClick={() => setShowManager(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Manage Libraries
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Libraries
              </CardTitle>
              <Library className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{libraries.length}</div>
              <p className="text-xs text-muted-foreground">
                {libraries.filter((l) => l.isPublic).length} public
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Component Templates
              </CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTemplates}</div>
              <p className="text-xs text-muted-foreground">
                Reusable configurations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Component Types
              </CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">14</div>
              <p className="text-xs text-muted-foreground">
                API, Service, Database, Cache, Queue, etc.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Component Browser */}
        <Card>
          <CardHeader>
            <CardTitle>Browse Components</CardTitle>
            <CardDescription>
              Search and filter through available component templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {organizationId ? (
              <ComponentTemplateBrowser
                organizationId={organizationId}
                selectedTemplateId={selectedTemplate}
                onSelect={(template) => setSelectedTemplate(template.id)}
              />
            ) : (
              <p className="text-muted-foreground">Loading organization...</p>
            )}
          </CardContent>
        </Card>

        {/* Template Manager Dialog */}
        {organizationId && (
          <ComponentTemplateManagerDialog
            open={showManager}
            onOpenChange={setShowManager}
            organizationId={organizationId}
          />
        )}
      </main>
    </>
  );
}
