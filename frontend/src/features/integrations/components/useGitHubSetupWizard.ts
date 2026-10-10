import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import type {
  GitHubConfig,
  GitHubCredentials,
  GitHubRepository,
  GitHubLabel,
} from "../types";

export type WizardStep = "credentials" | "repository" | "labels" | "confirm";

interface UseGitHubSetupWizardProps {
  organizationId: string;
  onComplete: () => void;
  onOpenChange: (open: boolean) => void;
}

export function useGitHubSetupWizard({
  organizationId,
  onComplete,
  onOpenChange,
}: UseGitHubSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [tokenValid, setTokenValid] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(
    null,
  );
  const [labels, setLabels] = useState<GitHubLabel[]>([]);
  const [threatLabel, setThreatLabel] = useState("threat");
  const [mitigationLabel, setMitigationLabel] = useState("mitigation");
  const [autoCreateIssues, setAutoCreateIssues] = useState(false);
  const [syncDirection, setSyncDirection] = useState<
    "PUSH_ONLY" | "PULL_ONLY" | "BIDIRECTIONAL"
  >("PUSH_ONLY");

  const resetWizard = () => {
    setStep("credentials");
    setToken("");
    setTokenValid(false);
    setRepositories([]);
    setSelectedRepo(null);
    setLabels([]);
    setThreatLabel("threat");
    setMitigationLabel("mitigation");
    setAutoCreateIssues(false);
    setSyncDirection("PUSH_ONLY");
    setError(null);
  };

  const goBack = () => {
    setError(null);
    switch (step) {
      case "repository":
        setStep("credentials");
        break;
      case "labels":
        setStep("repository");
        break;
      case "confirm":
        setStep("labels");
        break;
    }
  };

  const validateToken = async () => {
    if (!token.trim()) {
      setError("Please enter a Personal Access Token");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Raw fetch: external GitHub API, not our API.
      const response = await fetch(
        "https://api.github.com/user/repos?per_page=100&sort=updated",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Invalid token. Please check your Personal Access Token."
            : "Failed to connect to GitHub. Please try again.",
        );
      }
      const repos: GitHubRepository[] = await response.json();
      setRepositories(repos);
      setTokenValid(true);
      setStep("repository");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to validate token"));
    } finally {
      setLoading(false);
    }
  };

  const selectRepository = async (repo: GitHubRepository) => {
    setSelectedRepo(repo);
    setLoading(true);
    setError(null);
    try {
      // Raw fetch: external GitHub API, not our API.
      const response = await fetch(
        `https://api.github.com/repos/${repo.full_name}/labels`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch repository labels");
      const repoLabels: GitHubLabel[] = await response.json();
      setLabels(repoLabels);
      setStep("labels");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load repository"));
    } finally {
      setLoading(false);
    }
  };

  const saveIntegration = async () => {
    if (!selectedRepo) return;
    setLoading(true);
    setError(null);
    try {
      const config: GitHubConfig = {
        owner: selectedRepo.full_name.split("/")[0],
        repo: selectedRepo.name,
        labelForThreats: threatLabel,
        labelForMitigations: mitigationLabel,
        autoCreateIssues,
        syncDirection,
      };
      const credentials: GitHubCredentials = {
        type: "personal_access_token",
        token,
      };
      await apiPost(`/api/v1/organizations/${organizationId}/integrations`, {
        type: "GITHUB_ISSUES",
        name: `GitHub: ${selectedRepo.full_name}`,
        config,
        credentials,
        scopes: ["repo", "issues"],
      });
      onComplete();
      onOpenChange(false);
      resetWizard();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save integration"));
    } finally {
      setLoading(false);
    }
  };

  return {
    step,
    setStep,
    loading,
    error,
    token,
    setToken,
    tokenValid,
    repositories,
    selectedRepo,
    labels,
    threatLabel,
    setThreatLabel,
    mitigationLabel,
    setMitigationLabel,
    autoCreateIssues,
    setAutoCreateIssues,
    syncDirection,
    setSyncDirection,
    resetWizard,
    goBack,
    validateToken,
    selectRepository,
    saveIntegration,
  };
}
