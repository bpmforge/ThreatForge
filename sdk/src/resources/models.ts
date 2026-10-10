import type { HttpClient } from "../client.js";
import type {
  ThreatModel,
  CreateThreatModelInput,
  UpdateThreatModelInput,
  PaginatedResult,
} from "../types.js";

export interface ListModelsParams {
  page?: number;
  limit?: number;
  projectId?: string;
  search?: string;
}

export class ModelsResource {
  constructor(private readonly http: HttpClient) {}

  list(params?: ListModelsParams): Promise<PaginatedResult<ThreatModel>> {
    return this.http.get("/api/threat-models", params);
  }

  get(modelId: string): Promise<ThreatModel> {
    return this.http.get(`/api/threat-models/${modelId}`);
  }

  create(input: CreateThreatModelInput): Promise<ThreatModel> {
    return this.http.post("/api/threat-models", input);
  }

  update(modelId: string, input: UpdateThreatModelInput): Promise<ThreatModel> {
    return this.http.put(`/api/threat-models/${modelId}`, input);
  }

  delete(modelId: string): Promise<void> {
    return this.http.delete(`/api/threat-models/${modelId}`);
  }

  /** Export model as JSON, YAML, or PDF (returns raw content string) */
  async export(
    modelId: string,
    format: "json" | "yaml" | "pdf",
  ): Promise<string> {
    const result = await this.http.get<{ content: string; format: string }>(
      `/api/threat-models/${modelId}/export`,
      { format },
    );
    return result.content;
  }

  /** Create a model from a GitHub repository URL */
  createFromGithub(
    repoUrl: string,
    token?: string,
  ): Promise<{
    modelId: string;
    scanned: number;
    filesScanned: number;
    created: number;
  }> {
    return this.http.post("/api/threat-models/create-from-github", {
      repoUrl,
      token,
    });
  }
}
