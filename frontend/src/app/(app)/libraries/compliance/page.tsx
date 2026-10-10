"use client";

/**
 * Custom Compliance Frameworks Management Page
 *
 * Allows organizations to create custom compliance frameworks
 * by defining categories, controls, and mapping to built-in frameworks.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Shield, ExternalLink } from "lucide-react";
import { AppHeader } from "@/components/layout";
import { toast } from "sonner";
import { COMPLIANCE_FRAMEWORKS } from "@/features/threat-library/constants/compliance";
import type { CustomFrameworkData, NewFrameworkForm } from "./types";
import { DEFAULT_NEW_FRAMEWORK } from "./types";
import { CreateFrameworkDialog } from "./CreateFrameworkDialog";
import { EditFrameworkDialog } from "./EditFrameworkDialog";
import { FrameworkCard } from "./FrameworkCard";

// Custom frameworks would come from API - start with empty array
const initialCustomFrameworks: CustomFrameworkData[] = [];

export default function ComplianceFrameworksPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedFramework, setSelectedFramework] =
    useState<CustomFrameworkData | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("custom");
  const [customFrameworks, setCustomFrameworks] = useState(
    initialCustomFrameworks,
  );
  const [newFramework, setNewFramework] = useState<NewFrameworkForm>(
    DEFAULT_NEW_FRAMEWORK,
  );

  const handleCreateFramework = () => {
    if (!newFramework.name || !newFramework.shortName) {
      toast.error("Name and short name are required");
      return;
    }

    const framework: CustomFrameworkData = {
      id: `custom-${Date.now()}`,
      name: newFramework.name,
      shortName: newFramework.shortName,
      description: newFramework.description,
      version: newFramework.version,
      color: newFramework.color,
      isPublic: newFramework.isPublic,
      categories: [],
      inheritedControls: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCustomFrameworks([...customFrameworks, framework]);
    setShowCreateDialog(false);
    setNewFramework(DEFAULT_NEW_FRAMEWORK);
    toast.success("Framework created successfully");
  };

  const handleDeleteFramework = (id: string) => {
    setCustomFrameworks(customFrameworks.filter((f) => f.id !== id));
    toast.success("Framework deleted");
  };

  const handleDuplicateFramework = (framework: CustomFrameworkData) => {
    const duplicate: CustomFrameworkData = {
      ...framework,
      id: `custom-${Date.now()}`,
      name: `${framework.name} (Copy)`,
      shortName: `${framework.shortName}-COPY`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCustomFrameworks([...customFrameworks, duplicate]);
    toast.success("Framework duplicated");
  };

  const filteredFrameworks = customFrameworks.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.shortName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Compliance Frameworks
            </h1>
            <p className="text-muted-foreground">
              Create and manage custom compliance frameworks
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Framework
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search frameworks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="custom">
              Custom Frameworks ({customFrameworks.length})
            </TabsTrigger>
            <TabsTrigger value="builtin">
              Built-in Frameworks ({COMPLIANCE_FRAMEWORKS.length})
            </TabsTrigger>
          </TabsList>

          {/* Custom Frameworks Tab */}
          <TabsContent value="custom" className="space-y-4">
            {filteredFrameworks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">
                    No custom frameworks yet
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first custom compliance framework to get started
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Framework
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFrameworks.map((framework) => (
                  <FrameworkCard
                    key={framework.id}
                    framework={framework}
                    onEdit={() => {
                      setSelectedFramework(framework);
                      setShowEditDialog(true);
                    }}
                    onDuplicate={() => handleDuplicateFramework(framework)}
                    onDelete={() => handleDeleteFramework(framework.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Built-in Frameworks Tab */}
          <TabsContent value="builtin" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {COMPLIANCE_FRAMEWORKS.map((framework) => (
                <Card
                  key={framework.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${framework.color}`}
                      />
                      <Badge variant="outline">{framework.shortName}</Badge>
                    </div>
                    <CardTitle className="text-lg">{framework.name}</CardTitle>
                    {framework.description && (
                      <CardDescription className="line-clamp-2">
                        {framework.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {framework.url && (
                        <a
                          href={framework.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Official Documentation
                        </a>
                      )}
                      <p className="text-xs text-muted-foreground">
                        This is a built-in framework. You can inherit controls
                        from it in your custom frameworks.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <CreateFrameworkDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          formData={newFramework}
          onFormChange={setNewFramework}
          onSubmit={handleCreateFramework}
        />

        <EditFrameworkDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          framework={selectedFramework}
        />
      </main>
    </>
  );
}
