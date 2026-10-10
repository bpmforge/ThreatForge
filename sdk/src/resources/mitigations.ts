import type { HttpClient } from "../client.js";
import type {
  Mitigation,
  CreateMitigationInput,
  UpdateMitigationInput,
  MitigationStatus,
} from "../types.js";

export class MitigationsResource {
  constructor(private readonly http: HttpClient) {}

  list(threatId: string): Promise<Mitigation[]> {
    return this.http.get(`/api/threats/${threatId}/mitigations`);
  }

  create(threatId: string, input: CreateMitigationInput): Promise<Mitigation> {
    return this.http.post(`/api/threats/${threatId}/mitigations`, input);
  }

  update(
    threatId: string,
    mitigationId: string,
    input: UpdateMitigationInput,
  ): Promise<Mitigation> {
    return this.http.put(
      `/api/threats/${threatId}/mitigations/${mitigationId}`,
      input,
    );
  }

  updateStatus(
    threatId: string,
    mitigationId: string,
    status: MitigationStatus,
  ): Promise<Mitigation> {
    return this.http.patch(
      `/api/threats/${threatId}/mitigations/${mitigationId}`,
      { status },
    );
  }

  delete(threatId: string, mitigationId: string): Promise<void> {
    return this.http.delete(
      `/api/threats/${threatId}/mitigations/${mitigationId}`,
    );
  }
}
