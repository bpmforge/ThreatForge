import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  buildCategoryChunkPrompt,
  buildCategoryPrompt,
  buildMitigationBatchPrompt,
} from "../micro-prompt-builder.js";
import type { CategoryReferenceData } from "../types.js";
import type { ComponentContext } from "../../../threat-generation/context-aware-pipeline.js";

// every static instruction lives in one system message per stage, so a
// local server can reuse the KV cache for that prefix across a whole run. The
// variable context (component, threat, requirements) goes in the user message.

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const refs = {
  threatTemplates: [
    {
      name: "Credential stuffing",
      description: "Automated login attempts",
      cweIds: ["CWE-307"],
    },
  ],
  cwes: [{ id: "CWE-287", name: "Improper Authentication" }],
  owaspEntries: [{ id: "A07:2021", name: "Auth Failures", relevance: "login" }],
  complianceReqs: [],
  ruleBasedSeeds: [],
} as unknown as CategoryReferenceData;

const api: ComponentContext = {
  id: "node-api",
  name: "Public API",
  type: "SERVICE",
  technologyVersion: "Express 4",
  dataClassification: "CONFIDENTIAL",
  dataTypes: ["PII"],
  complianceFrameworks: [],
  existingControls: ["TLS"],
  inbound: [],
  outbound: [],
} as unknown as ComponentContext;

const db: ComponentContext = {
  id: "node-db",
  name: "User DB",
  type: "DATABASE",
  technologyVersion: "PostgreSQL 16",
  dataClassification: "RESTRICTED",
  dataTypes: ["PII", "credentials"],
  complianceFrameworks: [],
  existingControls: [],
  inbound: [],
  outbound: [],
} as unknown as ComponentContext;

const CATEGORIES = [
  "SPOOFING",
  "TAMPERING",
  "REPUDIATION",
  "INFORMATION_DISCLOSURE",
  "DENIAL_OF_SERVICE",
  "ELEVATION_OF_PRIVILEGE",
];

describe("category stage — stable system prefix", () => {
  const prompts = [api, db].flatMap((c) =>
    CATEGORIES.map((cat) => buildCategoryPrompt(c, cat, refs)),
  );

  it("sends a byte-identical system message for every component and category", () => {
    expect(new Set(prompts.map((p) => sha(p.system))).size).toBe(1);
  });

  it("carries the output schema and GAPS rules in system, not user", () => {
    const { system, user } = prompts[0];
    expect(system).toContain('"gaps"');
    expect(system).toMatch(/Do NOT write vague gaps like "more context"/);
    expect(system).toContain('"cweIds"');
    expect(user).not.toContain('"gaps"');
    expect(user).not.toMatch(/Do NOT write vague gaps/);
    expect(user).not.toContain('"cweIds"');
  });

  it("keeps the variable task last in the user message", () => {
    const { user } = buildCategoryPrompt(db, "TAMPERING", refs);
    const tail = user.trimEnd().split("\n").slice(-3).join("\n");
    expect(tail).toContain("TAMPERING");
    expect(tail).toContain("PostgreSQL 16");
  });
});

describe("category-chunk stage — stable system prefix", () => {
  const chunks = [
    ["SPOOFING", "TAMPERING", "REPUDIATION"],
    ["INFORMATION_DISCLOSURE", "DENIAL_OF_SERVICE", "ELEVATION_OF_PRIVILEGE"],
  ];
  const prompts = [api, db].flatMap((c) =>
    chunks.map((cats) =>
      buildCategoryChunkPrompt(
        c,
        cats.map((category) => ({ category, refs })),
      ),
    ),
  );

  it("sends a byte-identical system message for every component and chunk", () => {
    expect(new Set(prompts.map((p) => sha(p.system))).size).toBe(1);
  });

  it("carries the keyed output schema in system, not user", () => {
    const { system, user } = prompts[0];
    expect(system).toContain("Never omit a listed category");
    expect(system).toContain('"cweIds"');
    expect(user).not.toContain('"cweIds"');
  });

  it("lists every category of the chunk and keeps the task last", () => {
    const { user } = prompts[3];
    expect(user).toContain(
      "## Categories: INFORMATION_DISCLOSURE, DENIAL_OF_SERVICE, ELEVATION_OF_PRIVILEGE",
    );
    for (const cat of chunks[1]) expect(user).toContain(`### Category: ${cat}`);
    const tail = user.trimEnd().split("\n").slice(-2).join("\n");
    expect(tail).toContain("Return one key per category.");
  });
});

describe("mitigation stage — stable system prefix", () => {
  const threatA = {
    name: "Credential stuffing",
    description: "Attacker replays leaked credentials",
    category: "SPOOFING",
    cweIds: ["CWE-307"],
  };
  const threatB = {
    name: "SQL injection",
    description: "Unparameterized query",
    category: "TAMPERING",
    cweIds: ["CWE-89"],
  };
  const reqs = [
    { reqId: "SEC-1", text: "MFA for admins", category: "security" },
  ];
  const prompts = [
    buildMitigationBatchPrompt(api, [threatA]),
    buildMitigationBatchPrompt(db, [threatB, threatA], reqs),
  ];

  it("sends a byte-identical system message for every threat", () => {
    expect(sha(prompts[0].system)).toBe(sha(prompts[1].system));
  });

  it("carries the counting rules, requirement-citation rule and schema in system, not user", () => {
    const { system } = prompts[0];
    for (const { user } of prompts) {
      expect(user).not.toMatch(/enumerate silently/);
      expect(user).not.toMatch(/Never invent reqIds/);
      expect(user).not.toContain('"testCriteria"');
    }
    expect(system).toMatch(/enumerate silently/);
    expect(system).toMatch(/Never invent reqIds/);
    expect(system).toContain('"testCriteria"');
  });
});
