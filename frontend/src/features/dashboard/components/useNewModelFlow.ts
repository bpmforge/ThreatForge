"use client";

import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCreateThreatModel } from "@/features/dashboard";
import { useProjects, useProject } from "@/features/projects";
import type { CreationMethod } from "./methods";
import { IMPORT_ENDPOINTS } from "./methods";
import {
  fetchTemplates,
  createFromTemplate,
} from "@/features/model-templates/services/api";
import { apiPost } from "@/lib/api-client";
import { createProject, getProjects } from "@/features/projects/services/api";

// Quick-start card slug -> the built-in model template it stands for. Slugs
// with no matching template fall back to a blank model.
const TEMPLATE_BUILTINS: Record<string, string> = {
  "web-app": "Standard Web Application",
  microservices: "Microservices on Kubernetes",
  "api-gateway": "API Gateway",
};

/** Instantiate a built-in template; null when it cannot be (caller goes blank). */
async function createFromBuiltIn(
  slug: string,
  name: string,
  projectId: string,
): Promise<{ id: string } | null> {
  const templateName = TEMPLATE_BUILTINS[slug];
  if (!templateName) return null;
  try {
    const { data } = await fetchTemplates({ search: templateName, limit: 10 });
    const template = data.find((t) => t.name === templateName);
    if (!template) return null;
    // from-template needs a project; use the given one, else the first, else a new default.
    const pid =
      projectId ||
      (await getProjects())[0]?.id ||
      (await createProject({ name: "Default Project" })).id;
    return await createFromTemplate(template.id, { projectId: pid, name });
  } catch {
    return null;
  }
}

export function useNewModelFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("projectId");
  const templateParam = searchParams.get("template");

  // Quick-start templates from the empty-dashboard cards: land directly on the
  // form with a sensible prefilled name instead of the method chooser.
  const TEMPLATE_NAMES: Record<string, string> = {
    "web-app": "Web Application",
    "api-gateway": "API Gateway",
    microservices: "Microservices Architecture",
  };
  const templateName =
    templateParam && TEMPLATE_NAMES[templateParam]
      ? TEMPLATE_NAMES[templateParam]
      : null;

  const [method, setMethod] = useState<CreationMethod>(
    templateName ? "blank" : "choose",
  );
  const [name, setName] = useState(templateName ?? "");
  const [description, setDescription] = useState("");
  const [importContent, setImportContent] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const { data: projects } = useProjects();
  const { data: project } = useProject(projectIdParam || "");
  const createModel = useCreateThreatModel();

  const projectId = projectIdParam || selectedProjectId;
  const backHref = projectIdParam
    ? `/projects/${projectIdParam}`
    : "/dashboard";
  const backLabel = projectIdParam && project ? project.name : "Dashboard";

  async function handleCreate() {
    setError(null);

    if (!name.trim() || name.trim().length < 3) {
      setError("Model name must be at least 3 characters");
      return;
    }

    try {
      const importEndpoint = IMPORT_ENDPOINTS[method];
      if (importEndpoint) {
        if (!importContent.trim()) {
          setError("Paste or type the file content to import");
          return;
        }
        setIsImporting(true);
        const data = await apiPost<{ modelId: string }>(importEndpoint, {
          content: importContent.trim(),
          name: name.trim(),
          projectId: projectId || undefined,
        });
        setIsImporting(false);
        router.push(`/models/${data.modelId}`);
        return;
      }

      if (method === "blank" && templateParam) {
        setIsImporting(true);
        const fromTemplate = await createFromBuiltIn(
          templateParam,
          name.trim(),
          projectId,
        );
        setIsImporting(false);
        if (fromTemplate) {
          router.push(`/models/${fromTemplate.id}`);
          return;
        }
      }

      const model = await createModel.mutateAsync({
        name: name.trim(),
        projectId: projectId || undefined,
      });

      if (method === "blank") {
        router.push(`/models/${model.id}`);
      } else if (method === "describe" && description.trim()) {
        router.push(
          `/models/${model.id}?import=text&content=${encodeURIComponent(description.trim())}`,
        );
      } else if (method === "import") {
        router.push(`/models/${model.id}?import=file`);
      } else if (method === "template") {
        router.push(`/models/${model.id}?import=template`);
      } else if (method === "github" && repoUrl.trim()) {
        const match = repoUrl.trim().match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
          setError(
            "Invalid GitHub URL. Use format: https://github.com/owner/repo",
          );
          return;
        }
        setIsImporting(true);
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(`ftm_github_repo_${model.id}`, repoUrl.trim());
          }
          const analysis = await apiPost<{ extractedContent?: string }>(
            `/api/v1/organizations/${projectId || "default"}/integrations/github/analyze`,
            {
              owner: match[1],
              repo: match[2].replace(/\.git$/, ""),
            },
          );
          const content = analysis?.extractedContent ?? "";
          router.push(
            content
              ? `/models/${model.id}?import=text&content=${encodeURIComponent(content)}`
              : `/models/${model.id}`,
          );
        } catch {
          router.push(`/models/${model.id}`);
        } finally {
          setIsImporting(false);
        }
      } else {
        router.push(`/models/${model.id}`);
      }
    } catch (err) {
      setIsImporting(false);
      setError(getErrorMessage(err, "Failed to create model"));
    }
  }

  return {
    templateLabel: templateParam
      ? (TEMPLATE_BUILTINS[templateParam] ?? null)
      : null,
    method,
    setMethod,
    name,
    setName,
    description,
    setDescription,
    importContent,
    setImportContent,
    repoUrl,
    setRepoUrl,
    selectedProjectId,
    setSelectedProjectId,
    error,
    setError,
    isImporting,
    projectIdParam,
    projects,
    backHref,
    backLabel,
    createModel,
    handleCreate,
  };
}
