/**
 * Role inference exists to fill a coverage gap without hiding a guess.
 *
 * The asymmetry that shapes these tests: failing to infer loses reference data,
 * which is recoverable. Inferring wrongly and SILENTLY points the whole threat
 * analysis at the wrong weakness class, which is not. So most of the assertions
 * here are about restraint and about the review flag, not about hit rate.
 */
import { describe, it, expect } from "vitest";
import {
  inferSecurityRole,
  describeInference,
  type InferenceInput,
} from "../role-inference.js";

const base: InferenceInput = {
  id: "c1",
  name: "Thing",
  type: "MICROSERVICE",
  dataTypes: [],
};

describe("inferSecurityRole", () => {
  it("never overrides a type that already has reference data", () => {
    for (const type of [
      "DATABASE",
      "API",
      "WEB_APP",
      "AUTH_SERVICE",
      "OBJECT_STORAGE",
    ]) {
      const r = inferSecurityRole({
        ...base,
        type,
        name: "Auth Service",
        description: "handles authentication and login",
        dataTypes: ["password hashes"],
      });
      expect(r, `${type} must be left alone`).toBeNull();
    }
  });

  it("infers AUTH_SERVICE for the go-forward case that motivated this", () => {
    const r = inferSecurityRole({
      ...base,
      name: "Auth Service",
      description:
        "Issues and verifies JWTs, manages credentials, MFA, and password reset flows.",
      dataTypes: ["password hashes", "MFA secrets", "refresh tokens"],
    });
    if (!r) throw new Error("expected an inference for the auth service");
    expect(r.inferredRole).toBe("AUTH_SERVICE");
    expect(r.confidence).toBe("HIGH");
    expect(r.needsReview).toBe(false);
  });

  it("records evidence, so a reviewer need not re-derive the guess", () => {
    const r = inferSecurityRole({
      ...base,
      name: "Identity Broker",
      dataTypes: ["credentials"],
    });
    if (!r) throw new Error("expected an inference");
    expect(r.evidence.length).toBeGreaterThan(0);
    expect(r.evidence.join(" ")).toMatch(/identity|credential/i);
  });

  it("flags a weak-signal-only inference for review rather than trusting it", () => {
    const r = inferSecurityRole({
      ...base,
      name: "Session Relay",
      description: "passes session data between services",
    });
    if (!r) throw new Error("expected a low-confidence inference");
    expect(r.confidence).toBe("LOW");
    expect(r.needsReview).toBe(true);
  });

  it("never infers a software role for a person or a third party", () => {
    // The go-forward End User: an ACTOR described as using a browser, carrying
    // session cookies. Scored WEB_APP at HIGH before this rule — a wrong
    // inference that would have been applied without raising the review flag.
    for (const type of ["ACTOR", "EXTERNAL_ENTITY", "EXTERNAL_USER"]) {
      const r = inferSecurityRole({
        ...base,
        type,
        name: "End User",
        description: "Customer using a browser to shop and manage orders.",
        dataTypes: ["session cookies", "form input"],
      });
      expect(r, `${type} must never be inferred for`).toBeNull();
    }
  });

  it("returns null rather than guessing when nothing fires", () => {
    expect(
      inferSecurityRole({
        ...base,
        name: "Order Service",
        description: "Order lifecycle: cart to placed to fulfilled.",
        dataTypes: ["order records", "shipping addresses"],
      }),
    ).toBeNull();
  });

  it("does not read a queue or cache as an auth service", () => {
    const queue = inferSecurityRole({
      ...base,
      type: "QUEUE",
      name: "RabbitMQ Broker",
      description: "Async event backbone: order-placed, invoice-created.",
      dataTypes: ["order events", "billing events"],
    });
    expect(queue?.inferredRole).not.toBe("AUTH_SERVICE");
  });

  it("marks every non-HIGH inference for review", () => {
    const samples: InferenceInput[] = [
      { ...base, name: "Login Gateway", description: "handles login" },
      { ...base, name: "Token Store", description: "keeps tokens" },
      { ...base, name: "Asset Bucket", description: "stores uploaded files" },
    ];
    for (const s of samples) {
      const r = inferSecurityRole(s);
      if (r && r.confidence !== "HIGH") expect(r.needsReview).toBe(true);
    }
  });

  it("describes an inference as a question, marking the ones needing review", () => {
    const r = inferSecurityRole({
      ...base,
      name: "Session Relay",
      description: "passes session data between services",
    });
    if (!r) throw new Error("expected an inference to describe");
    const line = describeInference(r);
    expect(line).toContain("REVIEW");
    expect(line).toContain("drawn as MICROSERVICE");
    expect(line).toContain("AUTH_SERVICE");
  });
});
