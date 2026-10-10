"use client";

/**
 * Security Scanners Page
 *
 * Surfaces SAST/DAST scanner findings (Snyk, SonarQube, OWASP ZAP, Burp, etc.)
 * for a selected project. Previously the ScannerPanel feature was built and
 * exported but never mounted anywhere — this is its entry point.
 */
import { useState } from "react";
import { AppHeader } from "@/components/layout";
import { ScannerPanel } from "@/features/scanners";
import { useProjects } from "@/features/projects";
import { useCurrentOrgId } from "@/stores/org-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield } from "lucide-react";

export default function ScannersPage() {
  const currentOrgId = useCurrentOrgId();
  const { data: projects } = useProjects({
    organizationId: currentOrgId ?? undefined,
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Security Scanners
            </h1>
            <p className="text-muted-foreground text-sm">
              Review SAST/DAST findings and map them to threat-model components.
            </p>
          </div>

          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {(projects ?? []).map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedProjectId ? (
            <ScannerPanel projectId={selectedProjectId} />
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                Select a project to view its security scan findings.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
