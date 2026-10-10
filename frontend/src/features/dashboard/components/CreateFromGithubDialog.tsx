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
import { Loader2, Github, CheckCircle2, LayoutTemplate } from "lucide-react";
import { SaveAsTemplateDialog } from "@/features/model-templates";
import { apiPost } from "@/lib/api-client";

function repoNameFromUrl(url: string): string {
  const parts = url.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] ?? "GitHub Model";
}

interface CreateFromGithubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanResult {
  modelId: string;
  message: string;
  scanned: number;
  filesScanned: number;
  created: number;
}

export function CreateFromGithubDialog({
  open,
  onOpenChange,
}: CreateFromGithubDialogProps) {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  const isValidUrl =
    repoUrl.includes("github.com/") && repoUrl.split("/").length >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUrl) return;

    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<ScanResult | undefined>(
        "/api/threat-models/create-from-github",
        {
          repoUrl: repoUrl.trim(),
          token: token.trim() || undefined,
        },
      );
      if (!data?.modelId) {
        throw new Error("Failed to create model");
      }
      setResult(data);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create model"));
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    if (!result) return;
    onOpenChange(false);
    router.push(`/models/${result.modelId}`);
  };

  const handleClose = () => {
    if (loading) return;
    setRepoUrl("");
    setToken("");
    setError(null);
    setResult(null);
    onOpenChange(false);
  };

  // Success state
  if (result) {
    return (
      <>
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Model created
              </DialogTitle>
              <DialogDescription>
                Scanned {result.filesScanned} file
                {result.filesScanned !== 1 ? "s" : ""} and created{" "}
                {result.created} mitigation
                {result.created !== 1 ? "s" : ""} from the repository.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Files scanned</span>
                <span className="font-medium">{result.filesScanned}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Controls found</span>
                <span className="font-medium">{result.scanned}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Mitigations created
                </span>
                <span className="font-medium text-green-600">
                  {result.created}
                </span>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowTemplateDialog(true)}
              >
                <LayoutTemplate className="h-4 w-4 mr-2" />
                Save as Template
              </Button>
              <Button className="flex-1" onClick={handleOpen}>
                Open Model →
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SaveAsTemplateDialog
          open={showTemplateDialog}
          onOpenChange={setShowTemplateDialog}
          modelId={result.modelId}
          modelName={repoNameFromUrl(repoUrl)}
        />
      </>
    );
  }

  // Input state
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Create Model from GitHub
            </DialogTitle>
            <DialogDescription>
              Paste a GitHub repository URL. ThreatForge will create a threat
              model and scan the codebase for existing security controls.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <Input
                id="repo-url"
                placeholder="https://github.com/owner/repo"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  setError(null);
                }}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gh-token">
                Personal Access Token{" "}
                <span className="text-muted-foreground font-normal">
                  (optional — required for private repos)
                </span>
              </Label>
              <Input
                id="gh-token"
                type="password"
                placeholder="ghp_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>

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
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValidUrl || loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? "Scanning…" : "Create & Scan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
