import type { HttpClient } from "../client.js";
import type {
  Threat,
  CreateThreatInput,
  UpdateThreatInput,
  PaginatedResult,
  Severity,
  ThreatStatus,
} from "../types.js";

export interface ListThreatsParams {
  page?: number;
  limit?: number;
  severity?: Severity;
  status?: ThreatStatus;
  componentNodeId?: string;
}

export class ThreatsResource {
  constructor(private readonly http: HttpClient) {}

  list(
    modelId: string,
    params?: ListThreatsParams,
  ): Promise<PaginatedResult<Threat>> {
    return this.http.get(`/api/threat-models/${modelId}/threats`, params);
  }

  get(modelId: string, threatId: string): Promise<Threat> {
    return this.http.get(`/api/threat-models/${modelId}/threats/${threatId}`);
  }

  create(modelId: string, input: CreateThreatInput): Promise<Threat> {
    return this.http.post(`/api/threat-models/${modelId}/threats`, input);
  }

  update(
    modelId: string,
    threatId: string,
    input: UpdateThreatInput,
  ): Promise<Threat> {
    return this.http.put(
      `/api/threat-models/${modelId}/threats/${threatId}`,
      input,
    );
  }

  updateStatus(
    modelId: string,
    threatId: string,
    status: ThreatStatus,
  ): Promise<Threat> {
    return this.http.patch(
      `/api/threat-models/${modelId}/threats/${threatId}`,
      { status },
    );
  }

  delete(modelId: string, threatId: string): Promise<void> {
    return this.http.delete(
      `/api/threat-models/${modelId}/threats/${threatId}`,
    );
  }

  /** Trigger AI threat suggestions for the model (async job) */
  suggestThreats(
    modelId: string,
  ): Promise<{ jobId: string; statusUrl: string }> {
    return this.http.post(`/api/threat-models/${modelId}/ai/suggest-threats`);
  }
}
