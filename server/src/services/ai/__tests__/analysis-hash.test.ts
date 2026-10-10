/**
 * F-03 (R6) — analysisHash must key on peer identity, flow ordering, and
 * existingControls, not just peer TYPE.
 *
 * Before the fix, rewiring an edge to a same-type peer, reordering flows,
 * or changing existingControls all produced a byte-identical hash, which
 * made buildSkipSet (pipeline.ts) treat a materially different component
 * as already analyzed and skip it.
 */
import { describe, it, expect } from "vitest";
import { computeAnalysisHash } from "../analysis-hash.js";

function baseInput() {
  return {
    type: "SERVICE",
    name: "Order Service",
    description: "Handles orders",
    dataClassification: "INTERNAL",
    technology: "Node.js",
    trustLevel: "MEDIUM",
    dataHandled: JSON.stringify(["pii"]),
    accessPattern: "INTERNAL_ONLY",
    boundaryId: "boundary-1",
    existingControls: ["rate-limiting"],
    inbound: [
      {
        protocol: "HTTPS",
        encrypted: true,
        authentication: "JWT",
        peerType: "SERVICE",
        peerId: "node-peer-a",
      },
    ],
    outbound: [
      {
        protocol: "POSTGRESQL",
        encrypted: true,
        authentication: "NONE",
        peerType: "DATABASE",
        peerId: "node-peer-b",
      },
    ],
  };
}

describe("computeAnalysisHash", () => {
  it("produces an identical hash for identical input", () => {
    const a = computeAnalysisHash(baseInput());
    const b = computeAnalysisHash(baseInput());
    expect(a).toBe(b);
  });

  it("produces the same hash when an unrelated field is unchanged (control)", () => {
    const a = computeAnalysisHash(baseInput());
    const changed = baseInput();
    // sanity: identical copies (no field touched) stay equal
    const b = computeAnalysisHash(changed);
    expect(a).toBe(b);
  });

  it("changes the hash when an edge is rewired to a different peer of the SAME type", () => {
    const before = computeAnalysisHash(baseInput());

    const rewired = baseInput();
    // Same peerType ("SERVICE"), different underlying node — this is the
    // exact collision R6 flags.
    rewired.inbound[0].peerId = "node-peer-c";

    const after = computeAnalysisHash(rewired);
    expect(after).not.toBe(before);
  });

  it("changes the hash when flows are reordered", () => {
    const twoFlows = baseInput();
    twoFlows.inbound = [
      {
        protocol: "HTTPS",
        encrypted: true,
        authentication: "JWT",
        peerType: "SERVICE",
        peerId: "node-peer-a",
      },
      {
        protocol: "HTTP",
        encrypted: false,
        authentication: "NONE",
        peerType: "EXTERNAL_SYSTEM",
        peerId: "node-peer-d",
      },
    ];
    const before = computeAnalysisHash(twoFlows);

    const reordered = baseInput();
    reordered.inbound = [twoFlows.inbound[1], twoFlows.inbound[0]];
    const after = computeAnalysisHash(reordered);

    expect(after).not.toBe(before);
  });

  it("changes the hash when existingControls changes", () => {
    const before = computeAnalysisHash(baseInput());

    const changed = baseInput();
    changed.existingControls = ["rate-limiting", "input-validation"];

    const after = computeAnalysisHash(changed);
    expect(after).not.toBe(before);
  });

  it("does not change the hash when existingControls is merely reordered", () => {
    const a = baseInput();
    a.existingControls = ["rate-limiting", "input-validation"];
    const before = computeAnalysisHash(a);

    const b = baseInput();
    b.existingControls = ["input-validation", "rate-limiting"];
    const after = computeAnalysisHash(b);

    expect(after).toBe(before);
  });
});
