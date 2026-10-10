"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileCode } from "lucide-react";

interface PublicTemplate {
  id: string;
  name: string;
  organizationName: string;
  downloads: number;
  description?: string;
  nodeCount: number;
  threatCount: number;
}

interface MarketplaceTemplatesTabProps {
  templates: PublicTemplate[] | undefined;
  loadingTemplates: boolean;
  searchQuery: string;
}

export function MarketplaceTemplatesTab({
  templates,
  loadingTemplates,
  searchQuery,
}: MarketplaceTemplatesTabProps) {
  if (loadingTemplates) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (templates && templates.length > 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription>{template.organizationName}</CardDescription>
                </div>
                <Badge variant="outline">{template.downloads} downloads</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {template.description}
              </p>
              <div className="flex gap-3 text-sm text-muted-foreground">
                <span>{template.nodeCount} components</span>
                <span>{template.threatCount} threats</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <FileCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">
          {searchQuery
            ? "No templates match your search"
            : "No public templates available yet"}
        </p>
      </CardContent>
    </Card>
  );
}
