"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Globe, Cloud, Eye, Settings } from "lucide-react";
import { IndexManagementPanel } from "@/features/threat-catalog";
import { SourceGroup } from "./SourceGroup";
import { LibraryThreatCard } from "./LibraryThreatCard";
import type { LibraryThreat } from "../types";

type ThreatSource = "STRIDE" | "OWASP" | "CLOUD" | "LINDDUN";

const SOURCE_META: Record<
  ThreatSource,
  { label: string; description: string; icon: typeof Shield; color: string }
> = {
  STRIDE: {
    label: "STRIDE Core",
    description: "Essential threats for each STRIDE category",
    icon: Shield,
    color: "bg-blue-500",
  },
  OWASP: {
    label: "OWASP",
    description: "Web, API, and mobile security threats",
    icon: Globe,
    color: "bg-orange-500",
  },
  CLOUD: {
    label: "Cloud Security",
    description: "AWS, Azure, and GCP threats",
    icon: Cloud,
    color: "bg-purple-500",
  },
  LINDDUN: {
    label: "LINDDUN Privacy",
    description: "Privacy threat categories for data protection analysis",
    icon: Eye,
    color: "bg-teal-500",
  },
};

interface Library {
  id: string;
  name: string;
  templateCount?: number;
}

interface ThreatLibraryTabsSectionProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  filteredThreats: LibraryThreat[];
  getSourceThreats: (source: ThreatSource) => LibraryThreat[];
  onSelectThreat: (threat: LibraryThreat) => void;
  libraries: Library[];
}

export function ThreatLibraryTabsSection({
  activeTab,
  onTabChange,
  filteredThreats,
  getSourceThreats,
  onSelectThreat,
  libraries,
}: ThreatLibraryTabsSectionProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList>
        <TabsTrigger value="sources">By Source</TabsTrigger>
        <TabsTrigger value="all">
          All Threats ({filteredThreats.length})
        </TabsTrigger>
        <TabsTrigger value="indexes" className="flex items-center gap-1">
          <Settings className="h-3 w-3" /> Indexes
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sources" className="space-y-4 mt-4">
        {(["STRIDE", "OWASP", "CLOUD", "LINDDUN"] as const).map((source) => {
          const meta = SOURCE_META[source];
          const Icon = meta.icon;
          return (
            <SourceGroup
              key={source}
              icon={<Icon className="h-5 w-5" />}
              label={meta.label}
              description={meta.description}
              color={meta.color}
              threats={getSourceThreats(source)}
              onSelect={onSelectThreat}
            />
          );
        })}
        {libraries.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Custom Libraries</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {libraries.map((lib) => (
                  <div
                    key={lib.id}
                    className="p-3 border rounded-lg bg-muted/30"
                  >
                    <h4 className="font-medium text-sm">{lib.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {lib.templateCount ?? 0} templates
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="all" className="mt-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">
              {filteredThreats.length}{" "}
              {filteredThreats.length === 1 ? "threat" : "threats"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[600px]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredThreats.map((threat) => (
                  <LibraryThreatCard
                    key={threat.id}
                    threat={threat}
                    onSelect={onSelectThreat}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="indexes" className="mt-4">
        <IndexManagementPanel />
      </TabsContent>
    </Tabs>
  );
}
