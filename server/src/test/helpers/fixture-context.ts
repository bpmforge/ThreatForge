/**
 * Go-forward fixture loader for the replay harness.
 *
 * Builds the `ThreatModelContext` the micro pipeline takes from the
 * committed fixture model (server/src/test/fixtures/go-forward/
 * fixture-model.json). Extracted from scripts/record-parity-journal.ts
 * so the recorder and the parity CLI share one loader —
 * a divergence here would silently invalidate the journal.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ThreatModelContext,
  SequenceFlowContext,
} from "../../types/ai.js";

export interface FixtureFile {
  name: string;
  methodology: string;
  canvasState: {
    nodes: Array<{
      id: string;
      type: string;
      parentId?: string;
      data: {
        label: string;
        type: string;
        description?: string;
        trustLevel?: string;
        technology?: string;
        securityContext?: {
          dataClassification?: string;
          dataTypes?: string[];
          accessPattern?: string;
          complianceFrameworks?: string[];
          existingControls?: string[];
        };
      };
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      data?: {
        label?: string;
        protocol?: string;
        authentication?: string;
        encrypted?: boolean;
        dataClassifications?: string[];
      };
    }>;
  };
  sequenceDiagrams: SequenceFlowContext[];
}

export function buildFixtureContext(fixture: FixtureFile): ThreatModelContext {
  const componentNodes = fixture.canvasState.nodes.filter(
    (n) => n.type === "component",
  );
  return {
    name: fixture.name,
    methodology: fixture.methodology,
    components: componentNodes.map((n) => ({
      id: n.id,
      name: n.data.label,
      type: n.data.type,
      description: n.data.description,
      trustZone: n.data.trustLevel,
      properties: {
        technology: n.data.technology,
        dataClassification: n.data.securityContext?.dataClassification,
        dataHandled: n.data.securityContext?.dataTypes ?? [],
        accessPattern: n.data.securityContext?.accessPattern,
        complianceFrameworks:
          n.data.securityContext?.complianceFrameworks ?? [],
        existingControls: n.data.securityContext?.existingControls ?? [],
      },
    })),
    connections: fixture.canvasState.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.data?.label,
      protocol: e.data?.protocol,
      authentication: e.data?.authentication,
      encrypted: e.data?.encrypted,
      dataTypes: e.data?.dataClassifications,
    })),
    boundaries: fixture.canvasState.nodes
      .filter((n) => n.type === "boundary")
      .map((n) => ({
        id: n.id,
        name: n.data.label,
        trustLevel: n.data.trustLevel,
      })),
    sequenceFlows: fixture.sequenceDiagrams,
  };
}

/** Load fixture-model.json from a fixtures dir and build its context. */
export function loadFixtureContext(fixturesDir: string): ThreatModelContext {
  const fixture = JSON.parse(
    readFileSync(join(fixturesDir, "fixture-model.json"), "utf8"),
  ) as FixtureFile;
  return buildFixtureContext(fixture);
}
