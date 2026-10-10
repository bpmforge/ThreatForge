/**
 * API Smoke Test — exercises every major POST/PATCH/DELETE endpoint as the
 * demo user. Creates test resources, updates them, tests configuration
 * endpoints, then cleans up. Reports any non-2xx responses.
 *
 * Run:
 *   TOUR_BASE_URL=https://threatforge.bpmforge.com npx playwright test \
 *     --project=audits audits/api-smoke.spec.ts
 */
import { test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const DEMO_EMAIL = "demo-tour@threatforge.local";
const DEMO_PASSWORD = "DemoTour2026!";

interface ApiResult {
  group: string;
  method: string;
  path: string;
  status: number;
  ok: boolean;
  detail: string;
  ms: number;
}

function repoRoot() {
  return path.resolve(__dirname, "../../..");
}

/** Make an authenticated API call from the browser context. */
async function api(
  page: Page,
  method: string,
  urlPath: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: Record<string, unknown> }> {
  return page.evaluate(
    async ({ method, urlPath, body }) => {
      const isMutating = method !== "GET";
      const hasBody = body && method !== "GET" && method !== "DELETE";

      // Fetch CSRF token for mutating requests
      const headers: Record<string, string> = {};
      if (isMutating) {
        try {
          const csrfRes = await fetch("/api/csrf-token", {
            credentials: "include",
          });
          if (csrfRes.ok) {
            const csrfData = await csrfRes.json();
            const token = csrfData.csrfToken || csrfData.token;
            if (token) headers["x-csrf-token"] = token;
          }
        } catch {
          // CSRF not required for all endpoints
        }
      }

      if (hasBody) {
        headers["Content-Type"] = "application/json";
      }

      const opts: RequestInit = {
        method,
        credentials: "include",
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(hasBody ? { body: JSON.stringify(body) } : {}),
      };
      const res = await fetch(urlPath, opts);
      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        // No JSON body (e.g. 204)
      }
      return { status: res.status, data };
    },
    { method, urlPath, body },
  );
}

async function loginOnce(page: Page) {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

test.describe("Audit — API Smoke Test", () => {
  test("exercises all write endpoints", async ({ page }) => {
    test.setTimeout(300_000);

    const results: ApiResult[] = [];

    async function run(
      group: string,
      method: string,
      urlPath: string,
      body?: Record<string, unknown>,
      expectStatus?: number[],
    ): Promise<{ status: number; data: Record<string, unknown> }> {
      const t0 = Date.now();
      const res = await api(page, method, urlPath, body);
      const ms = Date.now() - t0;

      const expected = expectStatus || [200, 201, 204];
      const ok = expected.includes(res.status);
      const shortPath = urlPath.replace(/\/[a-z0-9]{20,}/g, "/:id");

      results.push({
        group,
        method,
        path: shortPath,
        status: res.status,
        ok,
        detail: ok ? "OK" : JSON.stringify(res.data).slice(0, 200),
        ms,
      });

      const icon = ok ? "✓" : "✗";
      console.log(`  ${icon} ${method} ${shortPath} → ${res.status} (${ms}ms)`);

      return res;
    }

    // ── Login ─────────────────────────────────────────────────────────────
    await loginOnce(page);

    // ══════════════════════════════════════════════════════════════════════
    // 1. THREAT MODELS — CRUD
    // ══════════════════════════════════════════════════════════════════════
    console.log("\n  ── Threat Models ──");

    // Get existing project for the model
    const projectsRes = await api(page, "GET", "/api/projects");
    const projectId =
      (projectsRes.data as { data?: { id: string }[] })?.data?.[0]?.id || null;

    const createModel = await run(
      "Threat Models",
      "POST",
      "/api/threat-models",
      {
        name: "API Smoke Test Model",
        ...(projectId ? { projectId } : {}),
      },
    );
    const modelId = (createModel.data as { data?: { id: string } })?.data?.id;

    if (modelId) {
      await run("Threat Models", "PATCH", `/api/threat-models/${modelId}`, {
        name: "API Smoke Test Model (updated)",
      });

      await run(
        "Threat Models",
        "PATCH",
        `/api/threat-models/${modelId}/status`,
        { status: "DRAFT" },
      );

      await run(
        "Threat Models",
        "PATCH",
        `/api/threat-models/${modelId}/tags`,
        { tags: ["smoke-test", "automated"] },
      );

      // Save canvas
      await run("Canvas", "POST", `/api/threat-models/${modelId}/save-canvas`, {
        nodes: [
          {
            id: "smoke-node-1",
            type: "component",
            position: { x: 100, y: 100 },
            data: { label: "Smoke Test API", type: "API" },
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      });

      // Duplicate
      const dupeRes = await run(
        "Threat Models",
        "POST",
        `/api/threat-models/${modelId}/duplicate`,
      );
      const dupeId = (dupeRes.data as { data?: { id: string } })?.data?.id;

      // ── Versions ──
      console.log("\n  ── Versions ──");
      const versionRes = await run(
        "Versions",
        "POST",
        `/api/threat-models/${modelId}/versions`,
        { name: "Smoke test snapshot" },
        [200, 201],
      );
      const versionId = (versionRes.data as { data?: { id: string } })?.data
        ?.id;

      if (versionId) {
        await run(
          "Versions",
          "PATCH",
          `/api/threat-models/${modelId}/versions/${versionId}`,
          { name: "Updated snapshot name" },
        );
      }

      // ── Threats ──
      console.log("\n  ── Threats ──");
      const threatRes = await run(
        "Threats",
        "POST",
        `/api/threat-models/${modelId}/threats`,
        {
          name: "Smoke Test Threat",
          description: "Created by API smoke test",
          strideCategories: ["SPOOFING"],
          severity: "MEDIUM",
          componentNodeId: "smoke-node-1",
        },
      );
      const threatId = (threatRes.data as { data?: { id: string } })?.data?.id;

      if (threatId) {
        await run(
          "Threats",
          "PATCH",
          `/api/threat-models/${modelId}/threats/${threatId}`,
          { name: "Smoke Test Threat (updated)", severity: "HIGH" },
        );

        // Review AI threat
        await run(
          "Threats",
          "PATCH",
          `/api/threat-models/${modelId}/threats/${threatId}/review`,
          { action: "accept" },
          [200, 400], // 400 if not AI_SUGGESTED
        );

        // ── Mitigations ──
        console.log("\n  ── Mitigations ──");
        const mitRes = await run(
          "Mitigations",
          "POST",
          `/api/threats/${threatId}/mitigations`,
          {
            description: "Smoke test mitigation",
            status: "PLANNED",
            priority: "MEDIUM",
          },
        );
        const mitId = (mitRes.data as { data?: { id: string } })?.data?.id;

        if (mitId) {
          await run(
            "Mitigations",
            "PATCH",
            `/api/threats/${threatId}/mitigations/${mitId}`,
            {
              description: "Updated smoke test mitigation",
              controlCategory: "IAM",
              testCriteria: "Verify authentication is enforced",
            },
          );

          // Delete mitigation
          await run(
            "Mitigations",
            "DELETE",
            `/api/threats/${threatId}/mitigations/${mitId}`,
            undefined,
            [200, 204],
          );
        }

        // Delete threat
        await run(
          "Threats",
          "DELETE",
          `/api/threat-models/${modelId}/threats/${threatId}`,
          undefined,
          [200, 204],
        );
      }

      // ── Sequence Diagrams ──
      console.log("\n  ── Sequence Diagrams ──");
      const seqRes = await run(
        "Sequence Diagrams",
        "POST",
        `/api/threat-models/${modelId}/sequences`,
        { name: "Smoke Test Sequence" },
      );
      const seqId = (seqRes.data as { data?: { id: string } })?.data?.id;

      if (seqId) {
        await run(
          "Sequence Diagrams",
          "PATCH",
          `/api/threat-models/${modelId}/sequences/${seqId}`,
          { name: "Updated Smoke Sequence" },
        );

        // Add participant
        const partRes = await run(
          "Sequence Diagrams",
          "POST",
          `/api/threat-models/${modelId}/sequences/${seqId}/participants`,
          { label: "Client", order: 0 },
        );
        const partId = (partRes.data as { data?: { id: string } })?.data?.id;

        // Delete participant
        if (partId) {
          await run(
            "Sequence Diagrams",
            "DELETE",
            `/api/threat-models/${modelId}/sequences/${seqId}/participants/${partId}`,
            undefined,
            [200, 204],
          );
        }

        // Delete sequence
        await run(
          "Sequence Diagrams",
          "DELETE",
          `/api/threat-models/${modelId}/sequences/${seqId}`,
          undefined,
          [200, 204],
        );
      }

      // ── Requirements ──
      console.log("\n  ── Requirements ──");
      const reqRes = await run(
        "Requirements",
        "POST",
        `/api/threat-models/${modelId}/requirements`,
        {
          reqId: "REQ-SMOKE-001",
          text: "System shall authenticate all API requests",
          category: "SECURITY",
        },
        [200, 201],
      );
      const reqId = (reqRes.data as { data?: { id: string } })?.data?.id;

      if (reqId) {
        await run(
          "Requirements",
          "DELETE",
          `/api/threat-models/${modelId}/requirements/${reqId}`,
          undefined,
          [200, 204],
        );
      }

      // Bulk requirements
      await run(
        "Requirements",
        "POST",
        `/api/threat-models/${modelId}/requirements/bulk`,
        {
          requirements: [
            {
              reqId: "REQ-BULK-001",
              text: "Bulk test requirement",
              category: "FUNCTIONAL",
            },
          ],
          source: "MANUAL",
        },
        [200, 201],
      );

      // ── DFDs ──
      console.log("\n  ── Data Flow Diagrams ──");
      const dfdRes = await run(
        "DFD",
        "POST",
        `/api/threat-models/${modelId}/dfds`,
        { name: "Smoke Test DFD" },
      );
      const dfdId = (dfdRes.data as { data?: { id: string } })?.data?.id;

      if (dfdId) {
        await run(
          "DFD",
          "PATCH",
          `/api/threat-models/${modelId}/dfds/${dfdId}`,
          { name: "Updated Smoke DFD" },
        );
        await run(
          "DFD",
          "DELETE",
          `/api/threat-models/${modelId}/dfds/${dfdId}`,
          undefined,
          [200, 204],
        );
      }

      // ── Cleanup: delete duplicate and test model ──
      if (dupeId) {
        await run(
          "Cleanup",
          "DELETE",
          `/api/threat-models/${dupeId}`,
          undefined,
          [200, 204],
        );
      }
      await run(
        "Cleanup",
        "DELETE",
        `/api/threat-models/${modelId}`,
        undefined,
        [200, 204],
      );
    }

    // ══════════════════════════════════════════════════════════════════════
    // 2. SETTINGS & CONFIGURATION
    // ══════════════════════════════════════════════════════════════════════
    console.log("\n  ── Settings ──");

    // Profile settings (GET to read, then test PATCH)
    const profileRes = await api(page, "GET", "/api/users/me");
    if (profileRes.status === 200) {
      await run("Settings", "PATCH", "/api/users/me", {
        name:
          (profileRes.data as { data?: { name?: string } })?.data?.name ||
          "Demo Tour",
      });
    }

    // Notification preferences
    await run(
      "Notifications",
      "POST",
      "/api/notifications/read-all",
      {},
      [200, 204],
    );

    // ══════════════════════════════════════════════════════════════════════
    // 3. THREAT LIBRARIES (read-only smoke — don't modify shared data)
    // ══════════════════════════════════════════════════════════════════════
    console.log("\n  ── Threat Libraries (read) ──");

    await run(
      "Threat Libraries",
      "GET" as string,
      "/api/threat-libraries",
      undefined,
      [200, 403],
    );

    // ══════════════════════════════════════════════════════════════════════
    // 4. ADMIN ENDPOINTS
    // ══════════════════════════════════════════════════════════════════════
    console.log("\n  ── Admin ──");

    await run("Admin", "GET" as string, "/api/admin/system", undefined, [200]);
    await run(
      "Admin",
      "GET" as string,
      "/api/admin/traces?limit=10",
      undefined,
      [200],
    );

    // Admin settings (read)
    await run("Admin", "GET" as string, "/api/admin/settings", undefined, [
      200,
    ]);

    // ══════════════════════════════════════════════════════════════════════
    // 5. AI ENDPOINTS (non-destructive)
    // ══════════════════════════════════════════════════════════════════════
    console.log("\n  ── AI ──");

    await run("AI", "GET" as string, "/api/ai/providers/health", undefined, [
      200,
    ]);

    // ══════════════════════════════════════════════════════════════════════
    // Write the report
    // ══════════════════════════════════════════════════════════════════════
    const dateStr = new Date().toISOString().slice(0, 10);
    const auditsDir = path.join(repoRoot(), "docs", "audits");
    if (!fs.existsSync(auditsDir)) fs.mkdirSync(auditsDir, { recursive: true });
    const reportPath = path.join(auditsDir, `api-smoke-${dateStr}.md`);

    const passed = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    const byGroup: Record<string, ApiResult[]> = {};
    for (const r of results) {
      if (!byGroup[r.group]) byGroup[r.group] = [];
      byGroup[r.group].push(r);
    }

    const lines: string[] = [];
    lines.push(`# API Smoke Test — ${dateStr}`);
    lines.push("");
    lines.push(
      `_Ran against \`${process.env.TOUR_BASE_URL || "default baseURL"}\` as \`${DEMO_EMAIL}\`._`,
    );
    lines.push("");
    lines.push(
      `**${passed.length} passed, ${failed.length} failed** out of ${results.length} endpoints tested.`,
    );
    lines.push("");

    if (failed.length > 0) {
      lines.push("## Failed Endpoints");
      lines.push("");
      lines.push("| Group | Method | Path | Status | Detail |");
      lines.push("|---|---|---|---|---|");
      for (const r of failed) {
        const detail = r.detail.replace(/\|/g, "\\|").replace(/\n/g, " ");
        lines.push(
          `| ${r.group} | ${r.method} | \`${r.path}\` | ${r.status} | ${detail} |`,
        );
      }
      lines.push("");
    }

    lines.push("## All Results by Group");
    lines.push("");

    for (const [group, groupResults] of Object.entries(byGroup)) {
      const groupFailed = groupResults.filter((r) => !r.ok);
      const icon = groupFailed.length > 0 ? "🔴" : "🟢";
      lines.push(`### ${icon} ${group}`);
      lines.push("");
      lines.push("| Method | Path | Status | Time | Result |");
      lines.push("|---|---|---|---|---|");
      for (const r of groupResults) {
        const result = r.ok ? "Pass" : `FAIL: ${r.detail.slice(0, 100)}`;
        lines.push(
          `| ${r.method} | \`${r.path}\` | ${r.status} | ${r.ms}ms | ${result.replace(/\|/g, "\\|")} |`,
        );
      }
      lines.push("");
    }

    fs.writeFileSync(reportPath, lines.join("\n"));
    console.log(
      `\n✓ Report written to ${path.relative(repoRoot(), reportPath)}`,
    );
    console.log(`  ${passed.length} passed, ${failed.length} failed`);
  });
});
