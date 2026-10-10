/**
 * Computes a stable SHA-256 hash of the fields that affect a component's threat surface.
 * Fields like positionX/Y, engineerNotes, aiNotes, and sourceText are excluded because
 * changing them does not introduce new threats.
 *
 * F-03 (R6): connections are keyed on the peer's stable identity (not just its
 * ComponentType, which collides across same-type rewires) and are hashed in the
 * caller-supplied order — reordering flows changes the hash. existingControls is
 * included, canonicalized (sorted) since control order carries no threat meaning.
 */
import { createHash } from "crypto";

interface ConnectionSummary {
  protocol: string | null;
  encrypted: boolean;
  authentication: string | null;
  peerType: string; // ComponentType of the other side
  peerId: string; // stable identity (node id) of the other side
}

interface ComponentHashInput {
  type: string;
  name: string;
  description?: string | null;
  dataClassification?: string | null;
  technology?: string | null;
  trustLevel: string;
  dataHandled: string; // JSON string — sorted before hashing
  accessPattern?: string | null;
  boundaryId?: string | null;
  existingControls?: string[] | null;
  inbound: ConnectionSummary[];
  outbound: ConnectionSummary[];
}

function connectionKey(c: ConnectionSummary): string {
  return `${c.peerId}|${c.peerType}|${c.protocol ?? ""}|${c.encrypted}|${c.authentication ?? ""}`;
}

export function computeAnalysisHash(input: ComponentHashInput): string {
  // Sort dataHandled JSON array for stable comparison
  let dataHandledSorted: string;
  try {
    const arr = JSON.parse(input.dataHandled);
    dataHandledSorted = JSON.stringify(
      Array.isArray(arr) ? [...arr].sort() : arr,
    );
  } catch {
    dataHandledSorted = input.dataHandled;
  }

  const existingControlsSorted = [...(input.existingControls ?? [])]
    .sort()
    .join(",");

  // NOT sorted: flow order is significant (F-03/R6) — a reordered edge list
  // hashes differently even when the same connections are present.
  const inboundKeys = input.inbound.map(connectionKey).join(";");
  const outboundKeys = input.outbound.map(connectionKey).join(";");

  const raw = [
    input.type,
    input.name,
    input.description ?? "",
    input.dataClassification ?? "",
    input.technology ?? "",
    input.trustLevel,
    dataHandledSorted,
    input.accessPattern ?? "",
    input.boundaryId ?? "",
    existingControlsSorted,
    `in:${inboundKeys}`,
    `out:${outboundKeys}`,
  ].join("\0");

  return createHash("sha256").update(raw).digest("hex");
}
