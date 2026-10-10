/**
 * CreateModelDialog - Dialog for creating a new threat model
 */
"use client";

import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Shield,
  Target,
  Crosshair,
  Radar,
  Eye,
  Layers,
} from "lucide-react";
import { useCreateThreatModel } from "../hooks/useDashboard";
import { useProjects } from "@/features/projects";

interface CreateModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a project (hides project selector when set) */
  defaultProjectId?: string;
  /** Project name for display when defaultProjectId is set */
  projectName?: string;
}

export function CreateModelDialog({
  open,
  onOpenChange,
  defaultProjectId,
  projectName,
}: CreateModelDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [methodology, setMethodology] = useState("STRIDE");
  const [projectId, setProjectId] = useState<string>(defaultProjectId || "");
  const [error, setError] = useState<string | null>(null);

  const { data: projects } = useProjects();
  const createModel = useCreateThreatModel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Model name is required");
      return;
    }

    if (name.trim().length < 3) {
      setError("Name must be at least 3 characters");
      return;
    }

    try {
      const model = await createModel.mutateAsync({
        name: name.trim(),
        projectId: projectId || undefined,
        methodology,
      });

      onOpenChange(false);
      setName("");
      setMethodology("STRIDE");
      setProjectId(defaultProjectId || "");
      setError(null);

      // Navigate to the new model
      router.push(`/models/${model.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create model"));
    }
  };

  const handleClose = () => {
    setName("");
    setProjectId(defaultProjectId || "");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Threat Model</DialogTitle>
            <DialogDescription>
              Start a new threat model for your application or system.
              {defaultProjectId && projectName && (
                <span className="block mt-1">
                  This model will be added to <strong>{projectName}</strong>.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="name">Name</Label>
                <span
                  className={`text-xs ${name.length > 80 ? "text-amber-500" : "text-muted-foreground"}`}
                >
                  {name.length}/100
                </span>
              </div>
              <Input
                id="name"
                placeholder="My Application Threat Model"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                maxLength={100}
                autoFocus
                className={error && !name.trim() ? "border-destructive" : ""}
                aria-invalid={!!error && !name.trim()}
              />
              {name.trim().length > 0 && name.trim().length < 3 && (
                <p className="text-xs text-amber-500">
                  Name should be at least 3 characters
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Threat Methodology</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    key: "STRIDE",
                    label: "STRIDE",
                    desc: "Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation",
                    icon: Shield,
                  },
                  {
                    key: "PASTA",
                    label: "PASTA",
                    desc: "Process for Attack Simulation and Threat Analysis",
                    icon: Target,
                  },
                  {
                    key: "KILL_CHAIN",
                    label: "Kill Chain",
                    desc: "Reconnaissance through Actions on Objectives",
                    icon: Crosshair,
                  },
                  {
                    key: "MITRE_ATTACK",
                    label: "MITRE ATT&CK",
                    desc: "Tactics, techniques, and procedures matrix",
                    icon: Radar,
                  },
                  {
                    key: "LINDDUN",
                    label: "LINDDUN",
                    desc: "Privacy-focused: Linkability, Identifiability, Non-repudiation, Detectability, Disclosure, Unawareness, Non-compliance",
                    icon: Eye,
                  },
                  {
                    key: "STRIDE_LINDDUN",
                    label: "STRIDE + LINDDUN",
                    desc: "Combined security and privacy threat analysis",
                    icon: Layers,
                  },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMethodology(m.key)}
                    className={`flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                      methodology === m.key
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <m.icon
                      className={`h-4 w-4 mt-0.5 shrink-0 ${methodology === m.key ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium">{m.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">
                        {m.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {!defaultProjectId && (
              <div className="space-y-2">
                <Label htmlFor="project">Project (optional)</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Organize your threat model within a project
                </p>
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createModel.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !name.trim() || name.trim().length < 3 || createModel.isPending
              }
            >
              {createModel.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Model
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
