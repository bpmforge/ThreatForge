import { useState } from "react";
import {
  useTestJiraConnection,
  useFetchJiraProjects,
  useFetchJiraIssueTypes,
  useCreateJiraIntegration,
} from "./useIntegrations";
import type { JiraProject, JiraIssueType } from "../types";
import { getErrorMessage } from "@/lib/errors";

type WizardStep = "credentials" | "project" | "mapping" | "confirm";
const STEPS: WizardStep[] = ["credentials", "project", "mapping", "confirm"];

export function useJiraWizard(orgId: string, onClose: () => void) {
  const [step, setStep] = useState<WizardStep>("credentials");
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("JIRA Integration");
  const [baseUrl, setBaseUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [connectionVerified, setConnectionVerified] = useState(false);

  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [issueTypes, setIssueTypes] = useState<JiraIssueType[]>([]);
  const [threatIssueType, setThreatIssueType] = useState("");
  const [mitigationIssueType, setMitigationIssueType] = useState("");

  const [autoCreate, setAutoCreate] = useState(false);
  const [syncDirection, setSyncDirection] = useState<
    "PUSH_ONLY" | "PULL_ONLY" | "BIDIRECTIONAL"
  >("PUSH_ONLY");

  const testConnection = useTestJiraConnection(orgId);
  const fetchProjects = useFetchJiraProjects(orgId);
  const fetchIssueTypes = useFetchJiraIssueTypes(orgId);
  const createIntegration = useCreateJiraIntegration(orgId);

  const resetForm = () => {
    setStep("credentials");
    setName("JIRA Integration");
    setBaseUrl("");
    setEmail("");
    setApiToken("");
    setConnectionVerified(false);
    setProjects([]);
    setSelectedProject("");
    setIssueTypes([]);
    setThreatIssueType("");
    setMitigationIssueType("");
    setAutoCreate(false);
    setSyncDirection("PUSH_ONLY");
    setError(null);
  };

  const handleTestConnection = async () => {
    setError(null);
    try {
      const creds = { baseUrl: baseUrl.trim(), email: email.trim(), apiToken };
      const result = await testConnection.mutateAsync(creds);
      if (result.success) {
        setConnectionVerified(true);
        const projectList = await fetchProjects.mutateAsync(creds);
        setProjects(projectList);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to connect to JIRA"));
    }
  };

  const handleProjectSelect = async (projectKey: string) => {
    setSelectedProject(projectKey);
    setError(null);
    try {
      const types = await fetchIssueTypes.mutateAsync({
        baseUrl: baseUrl.trim(),
        email: email.trim(),
        apiToken,
        projectKey,
      });
      setIssueTypes(types);
      const defaultType = types.find((t) => !t.subtask);
      if (defaultType) {
        setThreatIssueType(defaultType.id);
        setMitigationIssueType(defaultType.id);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to fetch issue types"));
    }
  };

  const handleCreate = async () => {
    setError(null);
    try {
      await createIntegration.mutateAsync({
        name: name.trim(),
        config: {
          baseUrl: baseUrl.trim(),
          projectKey: selectedProject,
          issueTypeIdThreat: threatIssueType || undefined,
          issueTypeIdMitigation: mitigationIssueType || undefined,
          autoCreateIssues: autoCreate,
          syncDirection,
        },
        credentials: { type: "api_token", email: email.trim(), apiToken },
      });
      onClose();
      resetForm();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create integration"));
    }
  };

  const canProceed = () => {
    switch (step) {
      case "credentials":
        return connectionVerified;
      case "project":
        return !!(selectedProject && issueTypes.length > 0);
      case "mapping":
        return !!(threatIssueType || mitigationIssueType);
      case "confirm":
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };

  const prevStep = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  };

  const isPending =
    testConnection.isPending ||
    fetchProjects.isPending ||
    fetchIssueTypes.isPending ||
    createIntegration.isPending;

  return {
    step,
    error,
    isPending,
    name,
    setName,
    baseUrl,
    setBaseUrl: (v: string) => {
      setBaseUrl(v);
      setConnectionVerified(false);
    },
    email,
    setEmail: (v: string) => {
      setEmail(v);
      setConnectionVerified(false);
    },
    apiToken,
    setApiToken: (v: string) => {
      setApiToken(v);
      setConnectionVerified(false);
    },
    connectionVerified,
    projects,
    selectedProject,
    issueTypes,
    threatIssueType,
    setThreatIssueType,
    mitigationIssueType,
    setMitigationIssueType,
    autoCreate,
    setAutoCreate,
    syncDirection,
    setSyncDirection,
    testConnection,
    createIntegration,
    handleTestConnection,
    handleProjectSelect,
    handleCreate,
    resetForm,
    canProceed,
    nextStep,
    prevStep,
  };
}
