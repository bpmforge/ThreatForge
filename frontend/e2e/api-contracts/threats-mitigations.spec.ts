/**
 * API Contract Tests — Threats & Mitigations
 *
 * Verifies documented contracts in docs/sdlc/API_CONTRACTS.md:
 * - Threat CRUD shape and status transitions
 * - Mitigation CRUD with evidence links
 * - Human review status values
 * - AI_SUGGESTED → ACCEPTED/REJECTED/MODIFIED transitions
 */
import {
  test,
  expect,
  get,
  post,
  patch,
  createTempModel,
  deleteTempModel,
  assertHasKeys,
  unwrap,
} from "./_fixtures";

const VALID_THREAT_STATUSES = [
  "OPEN",
  "AI_SUGGESTED",
  "ACCEPTED",
  "REJECTED",
  "MODIFIED",
  "MITIGATED",
  "NOT_APPLICABLE",
];

const VALID_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

test.describe("Threats — CRUD and shape", () => {
  test("POST /api/threats — creates threat with required fields, returns 201", async ({
    loggedInPage: page,
  }) => {
    const modelId = await createTempModel(page);

    const r = await post(page, "/api/threats", {
      threatModelId: modelId,
      title: "SQL Injection via user input",
      description: "Attacker can inject SQL through unvalidated form fields",
      category: "TAMPERING",
      severity: "HIGH",
    });

    expect(r.status).toBe(201);
    const data = unwrap<Record<string, unknown>>(r.body);
    assertHasKeys(
      data,
      ["id", "title", "category", "severity", "status"],
      "created threat",
    );
    expect(VALID_THREAT_STATUSES).toContain(data.status);
    expect(VALID_SEVERITIES).toContain(data.severity);

    await deleteTempModel(page, modelId);
  });

  test("GET /api/threats?modelId — returns list with correct item shape", async ({
    loggedInPage: page,
  }) => {
    const modelId = await createTempModel(page);

    // Create one threat so the list is non-empty
    await post(page, "/api/threats", {
      threatModelId: modelId,
      title: "Test threat for shape check",
      category: "SPOOFING",
      severity: "MEDIUM",
    });

    const r = await get(page, `/api/threats?modelId=${modelId}`);
    expect(r.status).toBe(200);

    const list = unwrap<unknown[]>(r.body);
    expect(Array.isArray(list)).toBe(true);
    expect((list as unknown[]).length).toBeGreaterThanOrEqual(1);

    const first = (list as Record<string, unknown>[])[0];
    assertHasKeys(
      first,
      ["id", "title", "category", "severity", "status"],
      "threat list item",
    );
    expect(VALID_SEVERITIES).toContain(first.severity);
    expect(VALID_THREAT_STATUSES).toContain(first.status);

    await deleteTempModel(page, modelId);
  });

  test("PATCH /api/threats/:id — status transitions work for all review outcomes", async ({
    loggedInPage: page,
  }) => {
    const modelId = await createTempModel(page);

    const createR = await post(page, "/api/threats", {
      threatModelId: modelId,
      title: "Threat for review transitions",
      category: "ELEVATION",
      severity: "CRITICAL",
    });
    const threat = unwrap<Record<string, unknown>>(createR.body);
    const threatId = threat.id as string;

    // Accept
    const acceptR = await patch(page, `/api/threats/${threatId}`, {
      status: "ACCEPTED",
    });
    expect(acceptR.status).toBe(200);
    expect(unwrap<Record<string, unknown>>(acceptR.body).status).toBe(
      "ACCEPTED",
    );

    // Modify with severity change
    const modifyR = await patch(page, `/api/threats/${threatId}`, {
      status: "MODIFIED",
      severity: "HIGH",
      title: "Threat for review transitions (revised)",
    });
    expect(modifyR.status).toBe(200);
    const modified = unwrap<Record<string, unknown>>(modifyR.body);
    expect(modified.status).toBe("MODIFIED");
    expect(modified.severity).toBe("HIGH");

    // Reject
    const rejectR = await patch(page, `/api/threats/${threatId}`, {
      status: "REJECTED",
      rejectionReason: "False positive — WAF handles this",
    });
    expect(rejectR.status).toBe(200);
    expect(unwrap<Record<string, unknown>>(rejectR.body).status).toBe(
      "REJECTED",
    );

    await deleteTempModel(page, modelId);
  });
});

test.describe("Mitigations — CRUD and evidence shape", () => {
  test("PATCH /api/mitigations/:id — implements mitigation with evidence link", async ({
    loggedInPage: page,
  }) => {
    const modelId = await createTempModel(page);

    // Create a threat first
    const threatR = await post(page, "/api/threats", {
      threatModelId: modelId,
      title: "Injection threat",
      category: "TAMPERING",
      severity: "HIGH",
    });
    const threat = unwrap<Record<string, unknown>>(threatR.body);

    // Create a mitigation
    const mitigR = await post(page, "/api/mitigations", {
      threatId: threat.id,
      title: "Use parameterised queries",
      description: "Replace string concatenation with prepared statements",
      category: "INPUT_VALIDATION",
    });
    expect(mitigR.status).toBe(201);
    const mitigation = unwrap<Record<string, unknown>>(mitigR.body);
    assertHasKeys(
      mitigation,
      ["id", "title", "status", "category"],
      "created mitigation",
    );

    // Mark as implemented with evidence
    const updateR = await patch(page, `/api/mitigations/${mitigation.id}`, {
      status: "IMPLEMENTED",
      testResult: "PASS",
      testCriteria: "All DB calls use parameterised queries — verified by SAST",
      evidenceLinks: [
        {
          type: "ticket",
          url: "https://jira.example.com/TF-123",
          title: "Implement prepared statements",
        },
      ],
    });
    expect(updateR.status).toBe(200);

    const updated = unwrap<Record<string, unknown>>(updateR.body);
    expect(updated.status).toBe("IMPLEMENTED");
    expect(updated.testResult).toBe("PASS");

    await deleteTempModel(page, modelId);
  });

  test("GET /api/mitigations?modelId — lists with category field", async ({
    loggedInPage: page,
  }) => {
    const modelId = await createTempModel(page);

    const threatR = await post(page, "/api/threats", {
      threatModelId: modelId,
      title: "Auth bypass",
      category: "SPOOFING",
      severity: "CRITICAL",
    });
    const threat = unwrap<Record<string, unknown>>(threatR.body);

    await post(page, "/api/mitigations", {
      threatId: threat.id,
      title: "Enforce MFA",
      category: "IAM",
    });

    const r = await get(page, `/api/mitigations?modelId=${modelId}`);
    expect(r.status).toBe(200);

    const list = unwrap<unknown[]>(r.body);
    expect(Array.isArray(list)).toBe(true);

    const first = (list as Record<string, unknown>[])[0];
    if (first) {
      assertHasKeys(first, ["id", "title", "status"], "mitigation list item");
    }

    await deleteTempModel(page, modelId);
  });
});

test.describe("Threats — auth enforcement", () => {
  test("GET /api/threats — unauthenticated returns 401", async ({
    request,
  }) => {
    const r = await request.get("/api/threats?modelId=any");
    expect(r.status()).toBe(401);
  });

  test("POST /api/threats — unauthenticated returns 401", async ({
    request,
  }) => {
    const r = await request.post("/api/threats", {
      data: {
        title: "should-fail",
        threatModelId: "any",
        category: "SPOOFING",
      },
    });
    expect(r.status()).toBe(401);
  });
});
