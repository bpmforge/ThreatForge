import { describe, it, expect } from "vitest";
import { requiredScopeFor, satisfyingScopes } from "./api-token-scopes.js";

const cases: [string, string, string | null][] = [
  ["GET", "/api/threat-models", "read:models"],
  ["GET", "/api/threat-models?limit=5", "read:models"],
  ["POST", "/api/threat-models", "write:models"],
  ["PUT", "/api/threat-models/abc", "write:models"],
  ["DELETE", "/api/threat-models/abc", "write:models"],
  ["POST", "/api/threat-models/create-from-github", "write:models"],
  ["GET", "/api/threat-models/abc/export?format=json", "read:models"],
  ["POST", "/api/threat-models/abc/ai/suggest-threats", "write:models"],
  ["GET", "/api/models/abc", "read:models"],
  ["GET", "/api/threat-models/abc/threats", "read:threats"],
  ["POST", "/api/threat-models/abc/threats", "write:threats"],
  ["PUT", "/api/threat-models/abc/threats/t1", "write:threats"],
  ["POST", "/api/threats/t1/mitigations", "write:threats"],
  ["GET", "/api/threats/t1/mitigations/m1", "read:threats"],
  ["GET", "/api/v1/threat-models", "read:models"],
  ["GET", "/api/v1/threat-models/abc/threats", "read:threats"],
  ["GET", "/api/v1/threat-models/abc/risk-summary", "read:models"],
  ["GET", "/api/projects", "read:projects"],
  ["POST", "/api/projects", "write:projects"],
  ["DELETE", "/api/projects/p1", "write:projects"],
  ["GET", "/api/organizations/o1", "read:organizations"],
  ["GET", "/api/v1/organizations/o1/marketplace", "read:organizations"],
  ["POST", "/api/organizations", null],
  ["PUT", "/api/v1/organizations/o1/integrations", null],
  ["GET", "/api/ci/scans?limit=1", "ci:read"],
  ["GET", "/api/ci/scans/s1/diff", "ci:read"],
  ["POST", "/api/ci/scan", "ci:write"],
  ["POST", "/api/ci/api-keys", null],
  ["GET", "/api/ci/webhook-secret", null],
  ["POST", "/api/users/me/api-tokens", null],
  ["GET", "/api/users/me", null],
  ["POST", "/api/auth/login", null],
  ["GET", "/api/admin/users", null],
  ["POST", "/api/threat-models/abc/sso", null],
  ["POST", "/api/users/me/two-factor/disable", null],
  ["GET", "/api/projects/p1/sessions", null],
  ["POST", "/api/scim-tokens", null],
  ["POST", "/api/auth/saml/acs", null],
  ["POST", "/api/change-password", null],
  ["GET", "/api/something-else", null],
  ["GET", "/health", null],
];

describe("requiredScopeFor", () => {
  it.each(cases)("%s %s -> %s", (method, url, expected) => {
    expect(requiredScopeFor(method, url)).toBe(expected);
  });

  it("treats HEAD and OPTIONS as reads", () => {
    expect(requiredScopeFor("HEAD", "/api/projects")).toBe("read:projects");
    expect(requiredScopeFor("OPTIONS", "/api/projects")).toBe("read:projects");
  });
});

describe("satisfyingScopes", () => {
  it("lets write:X satisfy read:X", () => {
    expect(satisfyingScopes("read:models")).toEqual([
      "read:models",
      "write:models",
    ]);
    expect(satisfyingScopes("write:models")).toEqual(["write:models"]);
    expect(satisfyingScopes("ci:read")).toEqual(["ci:read"]);
  });
});
