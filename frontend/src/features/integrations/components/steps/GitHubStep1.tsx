"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";

interface GitHubStep1Props {
  token: string;
  onTokenChange: (value: string) => void;
  loading: boolean;
  onValidateToken: () => void;
}

export function GitHubStep1({
  token,
  onTokenChange,
  loading,
  onValidateToken,
}: GitHubStep1Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="gh-token">Personal Access Token</Label>
        <Input
          id="gh-token"
          type="password"
          value={token}
          onChange={(e) => onTokenChange(e.target.value)}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        />
        <p className="text-xs text-muted-foreground">
          Create a token at{" "}
          <a
            href="https://github.com/settings/tokens/new?scopes=repo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            GitHub Settings <ExternalLink className="h-3 w-3" />
          </a>{" "}
          with `repo` scope.
        </p>
      </div>
      <Button
        onClick={onValidateToken}
        disabled={loading || !token.trim()}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Validating...
          </>
        ) : (
          "Continue"
        )}
      </Button>
    </div>
  );
}
