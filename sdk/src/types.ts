/** ThreatForge SDK — shared types */

export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ThreatStatus = "OPEN" | "MITIGATED" | "ACCEPTED" | "WONT_FIX";
export type ModelStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";
export type ExportFormat = "json" | "yaml" | "pdf" | "csv";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}

// ── Models ────────────────────────────────────────────────────────────────────

export interface ThreatModel {
  id: string;
  name: string;
  status: ModelStatus;
  version: number;
  tags: string[];
  projectId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  threatCount?: number;
  mitigationCount?: number;
}

export interface CreateThreatModelInput {
  name: string;
  projectId: string;
  status?: ModelStatus;
  tags?: string[];
}

export interface UpdateThreatModelInput {
  name?: string;
  status?: ModelStatus;
  tags?: string[];
}

// ── Threats ───────────────────────────────────────────────────────────────────

export interface Threat {
  id: string;
  name: string;
  description: string | null;
  severity: Severity;
  status: ThreatStatus;
  category: string | null;
  threatModelId: string;
  componentNodeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateThreatInput {
  name: string;
  description?: string;
  severity?: Severity;
  category?: string;
  componentNodeId?: string;
}

export interface UpdateThreatInput {
  name?: string;
  description?: string;
  severity?: Severity;
  status?: ThreatStatus;
  category?: string;
}

// ── Mitigations ───────────────────────────────────────────────────────────────

export type MitigationStatus =
  | "PROPOSED"
  | "ACCEPTED"
  | "IMPLEMENTED"
  | "REJECTED";

export interface Mitigation {
  id: string;
  description: string;
  status: MitigationStatus;
  threatId: string;
  effectivenessScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMitigationInput {
  description: string;
  status?: MitigationStatus;
}

export interface UpdateMitigationInput {
  description?: string;
  status?: MitigationStatus;
}

// ── Exports ───────────────────────────────────────────────────────────────────

export interface ExportResult {
  format: ExportFormat;
  content: string;
  filename: string;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  threatModelCount?: number;
}

// ── SDK Config ────────────────────────────────────────────────────────────────

export interface ThreatForgeClientConfig {
  /** API key (from Settings → API Tokens) */
  apiKey: string;
  /** Base URL of your ThreatForge instance. Defaults to http://localhost:3001 */
  baseUrl?: string;
  /** Request timeout in ms. Default: 30000 */
  timeout?: number;
}

export class ThreatForgeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ThreatForgeError";
  }
}
