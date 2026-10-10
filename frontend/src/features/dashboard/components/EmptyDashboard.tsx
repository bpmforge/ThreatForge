"use client";

import {
  Shield,
  FileCode,
  Box,
  CheckCircle,
  ArrowRight,
  Upload,
  Compass,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyDashboardProps {
  onCreateProject: () => void;
  /** @deprecated Use onSelectTemplate instead */
  onViewTemplates?: () => void;
  onSelectTemplate?: (templateType: string) => void;
  onImport?: () => void;
  onStartTour?: () => void;
}

export function EmptyDashboard({
  onCreateProject,
  onViewTemplates,
  onSelectTemplate,
  onImport,
  onStartTour,
}: EmptyDashboardProps) {
  const handleTemplate = (templateType: string) => {
    if (onSelectTemplate) {
      onSelectTemplate(templateType);
    } else {
      onViewTemplates?.();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <div className="text-center max-w-2xl">
        <Shield className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">
          Welcome to your Threat Model Dashboard
        </h2>
        <p className="text-muted-foreground mb-8">
          Get started by creating your first threat model or exploring our
          templates.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <Button onClick={onCreateProject} size="lg">
            Create Your First Threat Model
          </Button>
          {onImport && (
            <Button variant="outline" size="lg" onClick={onImport}>
              <Upload className="h-4 w-4 mr-2" />
              Import (JSON / YAML / draw.io)
            </Button>
          )}
          {(onViewTemplates || onSelectTemplate) && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleTemplate("browse")}
            >
              Browse Templates
            </Button>
          )}
          {onStartTour && (
            <Button variant="ghost" size="lg" onClick={onStartTour}>
              <Compass className="h-4 w-4 mr-2" />
              Take a tour
            </Button>
          )}
        </div>

        {(onViewTemplates || onSelectTemplate) && (
          <div className="mb-12">
            <h3 className="text-lg font-semibold mb-4">Or choose a template</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <Card
                className="w-48 p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleTemplate("web-app")}
              >
                <div className="flex flex-col items-center text-center">
                  <Box className="h-8 w-8 text-primary mb-2" />
                  <span className="font-medium">Web App</span>
                  <span className="text-[11px] text-muted-foreground mt-1">
                    Frontend, API, database with STRIDE threats
                  </span>
                </div>
              </Card>
              <Card
                className="w-48 p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleTemplate("api-gateway")}
              >
                <div className="flex flex-col items-center text-center">
                  <FileCode className="h-8 w-8 text-primary mb-2" />
                  <span className="font-medium">API</span>
                  <span className="text-[11px] text-muted-foreground mt-1">
                    REST/GraphQL service with auth and data flow threats
                  </span>
                </div>
              </Card>
              <Card
                className="w-48 p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleTemplate("microservices")}
              >
                <div className="flex flex-col items-center text-center">
                  <Shield className="h-8 w-8 text-primary mb-2" />
                  <span className="font-medium">Microservices</span>
                  <span className="text-[11px] text-muted-foreground mt-1">
                    Service mesh with inter-service trust boundaries
                  </span>
                </div>
              </Card>
            </div>
          </div>
        )}

        <div className="border-t pt-8">
          <h3 className="text-lg font-semibold mb-4">How It Works</h3>
          <div className="flex flex-wrap justify-center items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileCode className="h-4 w-4" />
              <span>Create model</span>
            </div>
            <ArrowRight className="h-4 w-4" />
            <div className="flex items-center gap-1">
              <Box className="h-4 w-4" />
              <span>Add components</span>
            </div>
            <ArrowRight className="h-4 w-4" />
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              <span>Identify threats</span>
            </div>
            <ArrowRight className="h-4 w-4" />
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              <span>Add mitigations</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
