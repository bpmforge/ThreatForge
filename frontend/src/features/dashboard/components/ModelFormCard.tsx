"use client";

import { Loader2, Wand2, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { METHODS, IMPORT_ENDPOINTS } from "./methods";
import { ImportContentField } from "./ImportContentField";
import type { CreationMethod } from "./methods";

const METHOD_DESCRIPTIONS: Partial<Record<CreationMethod, string>> = {
  describe:
    "Describe your system architecture and AI will generate a threat model.",
  import: "You'll upload your document after creating the model.",
  template: "You'll choose a template after creating the model.",
  github: "You'll connect your repository after creating the model.",
  blank: "Start with an empty canvas and drag components.",
  "import-terraform":
    "Paste your .tf file — we'll auto-detect AWS, GCP, and Azure resources.",
  "import-kubernetes":
    "Paste your Kubernetes manifests — we'll map Deployments, Services, Ingress, and more.",
  "import-docker-compose":
    "Paste your docker-compose.yml — we'll map services, volumes, and dependencies.",
  "import-tool":
    "Paste content from Microsoft TMT, OWASP Threat Dragon, or Threagile.",
  "import-yaml":
    "Paste a previously exported ThreatForge YAML file to recreate the model.",
};

const SUBMIT_LABEL: Partial<Record<CreationMethod, string>> = {
  describe: "Create & Generate",
  blank: "Create Model",
};

interface Project {
  id: string;
  name: string;
}

interface ModelFormCardProps {
  method: CreationMethod;
  /** Built-in template being instantiated (replaces the blank-canvas heading). */
  templateLabel?: string | null;
  name: string;
  description: string;
  importContent: string;
  repoUrl: string;
  selectedProjectId: string;
  projectIdParam: string | null;
  projects?: Project[];
  error: string | null;
  isPending: boolean;
  isImporting: boolean;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onImportContentChange: (v: string) => void;
  onRepoUrlChange: (v: string) => void;
  onProjectChange: (v: string) => void;
  onBack: () => void;
  onCreate: () => void;
}

export function ModelFormCard({
  method,
  templateLabel,
  name,
  description,
  importContent,
  repoUrl,
  selectedProjectId,
  projectIdParam,
  projects,
  error,
  isPending,
  isImporting,
  onNameChange,
  onDescriptionChange,
  onImportContentChange,
  onRepoUrlChange,
  onProjectChange,
  onBack,
  onCreate,
}: ModelFormCardProps) {
  const methodDef = METHODS.find((m) => m.id === method);
  const Icon = methodDef?.icon;
  const isImportMethod = !!IMPORT_ENDPOINTS[method];
  const busy = isPending || isImporting;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-6" onClick={onBack}>
          Back to options
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {Icon && <Icon className="h-5 w-5" />}
              {templateLabel ?? methodDef?.title ?? "New Model"}
            </CardTitle>
            <CardDescription>
              {templateLabel
                ? "Creates a model pre-populated with this template's components and threats."
                : METHOD_DESCRIPTIONS[method]}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Model Name</Label>
              <Input
                id="name"
                placeholder="My Application Threat Model"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                maxLength={100}
                autoFocus
              />
            </div>

            {method === "describe" && (
              <div className="space-y-2">
                <Label htmlFor="description">
                  Describe your system architecture
                </Label>
                <Textarea
                  id="description"
                  placeholder="We have a React frontend that talks to a Node.js API server..."
                  value={description}
                  onChange={(e) => onDescriptionChange(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wand2 className="h-3 w-3" />
                  AI will extract components, data flows, and suggest threats
                </p>
              </div>
            )}

            {method === "github" && (
              <div className="space-y-2">
                <Label htmlFor="repoUrl">GitHub Repository URL</Label>
                <Input
                  id="repoUrl"
                  placeholder="https://github.com/owner/repo"
                  value={repoUrl}
                  onChange={(e) => onRepoUrlChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Github className="h-3 w-3" />
                  AI will scan the codebase for architecture patterns
                </p>
              </div>
            )}

            {isImportMethod && (
              <ImportContentField
                method={method}
                value={importContent}
                onChange={onImportContentChange}
              />
            )}

            {!projectIdParam && (
              <div className="space-y-2">
                <Label htmlFor="project">Project (optional)</Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={onProjectChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((proj) => (
                      <SelectItem key={proj.id} value={proj.id}>
                        {proj.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                {error}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={onBack} disabled={busy}>
              Back
            </Button>
            <Button
              onClick={onCreate}
              disabled={!name.trim() || name.trim().length < 3 || busy}
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {SUBMIT_LABEL[method] ?? "Create & Continue"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
