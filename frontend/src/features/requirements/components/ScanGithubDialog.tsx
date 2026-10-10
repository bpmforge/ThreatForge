"use client";

/**
 * ScanGithubDialog — Scan a GitHub repo for existing security controls.
 * Creates COMPLETED mitigations with code evidence links under a
 * "Security Controls (Code Scan)" threat.
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { gapAnalysisApi } from "../services/gap-analysis-api";
import { Github, ExternalLink } from "lucide-react";
import { useIntegrations } from "@/features/integrations/hooks/useIntegrations";
import { useCurrentOrgId } from "@/stores/org-store";

interface ScanGithubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
}

/** Parse "GitHub - owner/repo" → "https://github.com/owner/repo". Returns null if it doesn't fit. */
function nameToRepoUrl(name: string): string | null {
  const m = name.match(/GitHub\s*-\s*([^/\s]+)\/([^/\s]+)/i);
  if (!m) return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}

export function ScanGithubDialog({
  open,
  onOpenChange,
  modelId,
}: ScanGithubDialogProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  // #46: pre-populate the picker from the org's connected GitHub integrations.
  const orgId = useCurrentOrgId();
  const { data: integrations = [] } = useIntegrations(orgId);
  const connectedGithubRepos = integrations
    .filter((i) => i.type === "GITHUB_ISSUES" && i.status === "ACTIVE")
    .map((i) => ({ id: i.id, url: nameToRepoUrl(i.name), display: i.name }))
    .filter((r): r is { id: string; url: string; display: string } => !!r.url);

  // Pre-populate from localStorage if the model was created via GitHub
  useEffect(() => {
    if (open && !repoUrl && typeof window !== "undefined") {
      const stored = localStorage.getItem(`ftm_github_repo_${modelId}`);
      if (stored) setRepoUrl(stored);
    }
  }, [open, modelId, repoUrl]);

  const reset = () => {
    setRepoUrl("");
    setBranch("");
    setToken("");
  };

  const handleScan = async () => {
    const match = repoUrl.trim().match(/github\.com\/([^/]+)\/([^/#]+)/);
    if (!match) {
      toast.error(
        "Enter a valid GitHub URL (e.g. https://github.com/org/repo)",
      );
      return;
    }
    const [, owner, repo] = match;
    setLoading(true);
    try {
      const result = await gapAnalysisApi.scanFromGithub(modelId, {
        owner,
        repo: repo.replace(/\.git$/, ""),
        branch: branch.trim() || undefined,
        token: token.trim() || undefined,
      });

      qc.invalidateQueries({ queryKey: ["gap-analysis", modelId] });
      qc.invalidateQueries({ queryKey: ["threats", modelId] });
      qc.invalidateQueries({ queryKey: ["documents", modelId] });

      if (result.created === 0) {
        toast.info(result.message ?? "No new controls detected");
      } else {
        toast.success(
          `Detected ${result.created} control${result.created !== 1 ? "s" : ""} across ${result.filesScanned} files` +
            (result.skipped > 0 ? ` (${result.skipped} already existed)` : ""),
        );
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message ?? "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  const isValid = /github\.com\/[^/]+\/[^/]+/.test(repoUrl.trim()) && !loading;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            Scan GitHub Repository
          </DialogTitle>
          <DialogDescription>
            Scans source files for existing security controls and creates
            COMPLETED mitigations with direct code evidence links.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {connectedGithubRepos.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Connected repos</Label>
              <div className="flex flex-wrap gap-1.5">
                {connectedGithubRepos.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRepoUrl(r.url)}
                    aria-label={`Select ${r.display}`}
                    aria-pressed={repoUrl === r.url}
                    className={`h-7 px-2 rounded text-xs border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                      repoUrl === r.url
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {r.display.replace(/^GitHub\s*-\s*/i, "")}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Or paste a URL below.
              </p>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="scan-repo-url" className="text-xs">
              Repository URL *
            </Label>
            <Input
              id="scan-repo-url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="scan-branch" className="text-xs">
                Branch
              </Label>
              <Input
                id="scan-branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="scan-token" className="text-xs">
                Token (private repos)
              </Label>
              <Input
                id="scan-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_…"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <ExternalLink className="h-3 w-3 shrink-0" />
            Public repos need no token. Results are attached as COMPLETED
            mitigations on a &quot;Security Controls (Code Scan)&quot; threat.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleScan} disabled={!isValid}>
            {loading ? "Scanning…" : "Scan Repository"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
