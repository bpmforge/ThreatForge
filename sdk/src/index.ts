/**
 * @threatforge/sdk — Official Node.js / TypeScript SDK
 *
 * @example
 * ```ts
 * import { ThreatForgeClient } from "@threatforge/sdk";
 *
 * const client = new ThreatForgeClient({ apiKey: "ftm_..." });
 *
 * const models = await client.models.list();
 * const threats = await client.threats.list(models.data[0].id);
 * ```
 */
import { HttpClient } from "./client.js";
import { ModelsResource } from "./resources/models.js";
import { ThreatsResource } from "./resources/threats.js";
import { MitigationsResource } from "./resources/mitigations.js";
import { ProjectsResource } from "./resources/projects.js";
import type { ThreatForgeClientConfig } from "./types.js";

export class ThreatForgeClient {
  /** Threat model CRUD + export + GitHub import */
  readonly models: ModelsResource;
  /** Threats within a model */
  readonly threats: ThreatsResource;
  /** Mitigations on a threat */
  readonly mitigations: MitigationsResource;
  /** Projects */
  readonly projects: ProjectsResource;

  constructor(config: ThreatForgeClientConfig) {
    const http = new HttpClient(config);
    this.models = new ModelsResource(http);
    this.threats = new ThreatsResource(http);
    this.mitigations = new MitigationsResource(http);
    this.projects = new ProjectsResource(http);
  }
}

// Re-export types for consumers
export type {
  ThreatForgeClientConfig,
  ThreatModel,
  CreateThreatModelInput,
  UpdateThreatModelInput,
  Threat,
  CreateThreatInput,
  UpdateThreatInput,
  Mitigation,
  CreateMitigationInput,
  UpdateMitigationInput,
  Project,
  Severity,
  ThreatStatus,
  MitigationStatus,
  ModelStatus,
  Pagination,
  PaginatedResult,
} from "./types.js";
export { ThreatForgeError } from "./types.js";
