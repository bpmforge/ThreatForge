/**
 * Scanner findings are keyed per project. The same scanner issue id imported
 * into two tenants' projects must give each its own row; an import into
 * project B must never overwrite project A's finding.
 *
 * SQLite test DB, like src/jobs/architectural-mitigations.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import type { ScannerFinding } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = resolve(__dirname, "../../../prisma/test.db");

const finding = (title: string): ScannerFinding => ({
  externalId: "SNYK-JS-LODASH-1018905",
  scannerType: "SNYK",
  title,
  description: "Prototype pollution",
  severity: "HIGH",
  category: "DEPENDENCY",
  cweIds: ["CWE-1321"],
  cveIds: [],
  firstSeen: new Date(),
  lastSeen: new Date(),
});

describe("scanner findings are per project", () => {
  let prisma: PrismaClient;
  let projectA: string;
  let projectB: string;
  let persistScanResults: typeof import("./scanner-service.js").persistScanResults;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
    const { setupTestDatabase, testData } = await import("../../test/setup.js");
    prisma = await setupTestDatabase();
    const user = await testData.createUser();
    const orgA = await testData.createOrganization({
      slug: `scan-a-${Date.now()}`,
    });
    const orgB = await testData.createOrganization({
      slug: `scan-b-${Date.now()}`,
    });
    projectA = (await testData.createProject(orgA.id, user.id)).id;
    projectB = (await testData.createProject(orgB.id, user.id)).id;
    ({ persistScanResults } = await import("./scanner-service.js"));
  }, 120_000);

  afterAll(async () => {
    const { teardownTestDatabase } = await import("../../test/setup.js");
    await teardownTestDatabase();
  });

  it("the same external id in two projects gives two rows; B never touches A", async () => {
    await persistScanResults(projectA, undefined, "SNYK", [
      finding("A's view"),
    ]);
    await persistScanResults(projectB, undefined, "SNYK", [
      finding("B's view"),
    ]);

    const rows = await prisma.scannerFinding.findMany({
      where: { externalId: "SNYK-JS-LODASH-1018905" },
      orderBy: { projectId: "asc" },
    });
    const byProject = Object.fromEntries(
      rows.map((r) => [r.projectId, r.title]),
    );
    expect(rows).toHaveLength(2);
    expect(byProject[projectA]).toBe("A's view");
    expect(byProject[projectB]).toBe("B's view");
  });

  it("re-importing into a project updates that project's row only", async () => {
    await persistScanResults(projectA, undefined, "SNYK", [finding("A again")]);

    const rows = await prisma.scannerFinding.findMany({
      where: { externalId: "SNYK-JS-LODASH-1018905" },
    });
    const byProject = Object.fromEntries(
      rows.map((r) => [r.projectId, r.title]),
    );
    expect(rows).toHaveLength(2);
    expect(byProject[projectA]).toBe("A again");
    expect(byProject[projectB]).toBe("B's view");
  });
});
