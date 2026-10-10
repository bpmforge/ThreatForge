import type { HttpClient } from "../client.js";
import type { Project, PaginatedResult } from "../types.js";

export interface ListProjectsParams {
  page?: number;
  limit?: number;
  organizationId?: string;
  search?: string;
}

export class ProjectsResource {
  constructor(private readonly http: HttpClient) {}

  list(params?: ListProjectsParams): Promise<PaginatedResult<Project>> {
    return this.http.get("/api/projects", params);
  }

  get(projectId: string): Promise<Project> {
    return this.http.get(`/api/projects/${projectId}`);
  }

  create(input: {
    name: string;
    description?: string;
    organizationId: string;
  }): Promise<Project> {
    return this.http.post("/api/projects", input);
  }

  update(
    projectId: string,
    input: { name?: string; description?: string },
  ): Promise<Project> {
    return this.http.put(`/api/projects/${projectId}`, input);
  }

  delete(projectId: string): Promise<void> {
    return this.http.delete(`/api/projects/${projectId}`);
  }
}
