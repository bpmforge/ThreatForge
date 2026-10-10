/**
 * Test Setup - Integration test utilities.
 *
 * Creates an isolated test database for each test run.
 */
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "../..");
const SCHEMA_DIR = path.resolve(SERVER_ROOT, "prisma/schema");
const TEST_DB_PATH = path.resolve(SERVER_ROOT, "prisma/test.db");

let testPrisma: PrismaClient | null = null;

/**
 * Resolve the test database URL. Defaults to a throwaway local SQLite file so
 * the zero-setup dev/CI path is unchanged. Set TEST_DATABASE_URL to a
 * `postgresql://…` string (e.g. the CI Postgres service) to exercise the real
 * production engine — this is what catches SQLite-vs-Postgres drift, the class
 * of bug behind the ~2-month login outage (PR #79).
 */
function resolveTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (
    url &&
    (url.startsWith("postgresql://") || url.startsWith("postgres://"))
  ) {
    return url;
  }
  return `file:${TEST_DB_PATH}`;
}

function providerForUrl(url: string): "postgresql" | "sqlite" {
  return url.startsWith("postgres") ? "postgresql" : "sqlite";
}

/**
 * Prisma requires the schema's `provider` to match the DATABASE_URL scheme. The
 * checked-in schema is sqlite; for a Postgres run we push from a COPY of the
 * schema dir with the provider flipped, so the tracked file stays clean (the CI
 * drift-guard never sees it move).
 */
function schemaDirForProvider(provider: "postgresql" | "sqlite"): string {
  if (provider === "sqlite") return SCHEMA_DIR;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-pg-schema-"));
  for (const file of fs.readdirSync(SCHEMA_DIR)) {
    const src = fs.readFileSync(path.join(SCHEMA_DIR, file), "utf8");
    const out = src.replace(
      /provider\s*=\s*"sqlite"/,
      'provider = "postgresql"',
    );
    fs.writeFileSync(path.join(tmpDir, file), out);
  }
  return tmpDir;
}

/**
 * Create a fresh test database and return the Prisma client.
 */
export async function setupTestDatabase(): Promise<PrismaClient> {
  const databaseUrl = resolveTestDatabaseUrl();
  const provider = providerForUrl(databaseUrl);

  // Align the app-facing env var with the resolved test URL so that tests which
  // seed/assert through the application's own getPrisma() (rather than
  // getTestPrisma()) build an adapter matching the active provider. Several
  // pipeline/parity tests set DATABASE_URL=file:… themselves; on the Postgres
  // lane that would pin them to SQLite and fail — this override wins.
  process.env.DATABASE_URL = databaseUrl;

  // SQLite: start from a clean file. (Postgres uses --force-reset below.)
  if (provider === "sqlite" && fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  const schemaDir = schemaDirForProvider(provider);
  try {
    // Push schema to create/reset the test database.
    // PRISMA_USER_CONSENT is required for destructive operations in AI contexts.
    execSync(
      `npx prisma db push --schema="${schemaDir}" --accept-data-loss --force-reset`,
      {
        cwd: SERVER_ROOT,
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes",
        },
        stdio: "pipe",
      },
    );
  } finally {
    // Clean up the throwaway Postgres schema copy.
    if (schemaDir !== SCHEMA_DIR) {
      fs.rmSync(schemaDir, { recursive: true, force: true });
    }
  }

  // Create the Prisma client with the adapter that matches the provider.
  if (provider === "postgresql") {
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    testPrisma = new PrismaClient({ adapter, log: ["error"] });
  } else {
    const { PrismaBetterSqlite3 } = await import(
      "@prisma/adapter-better-sqlite3"
    );
    const adapter = new PrismaBetterSqlite3({ url: `file:${TEST_DB_PATH}` });
    testPrisma = new PrismaClient({ adapter, log: ["error"] });
  }

  return testPrisma;
}

/**
 * Get the test Prisma client.
 */
export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    throw new Error(
      "Test database not initialized. Call setupTestDatabase first.",
    );
  }
  return testPrisma;
}

/**
 * Clean up test database.
 */
export async function teardownTestDatabase(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

/**
 * Clear all data from test database (for between tests).
 */
export async function clearTestDatabase(): Promise<void> {
  if (!testPrisma) return;

  // Delete in correct order to respect foreign keys
  await testPrisma.$executeRaw`DELETE FROM sequence_messages`;
  await testPrisma.$executeRaw`DELETE FROM sequence_participants`;
  await testPrisma.$executeRaw`DELETE FROM sequence_diagrams`;
  await testPrisma.$executeRaw`DELETE FROM mitigations`;
  await testPrisma.$executeRaw`DELETE FROM threats`;
  await testPrisma.$executeRaw`DELETE FROM connections`;
  await testPrisma.$executeRaw`DELETE FROM components`;
  await testPrisma.$executeRaw`DELETE FROM boundaries`;
  await testPrisma.$executeRaw`DELETE FROM threat_model_versions`;
  await testPrisma.$executeRaw`DELETE FROM threat_models`;
  await testPrisma.$executeRaw`DELETE FROM project_members`;
  await testPrisma.$executeRaw`DELETE FROM projects`;
  await testPrisma.$executeRaw`DELETE FROM memberships`;
  await testPrisma.$executeRaw`DELETE FROM organizations`;
  await testPrisma.$executeRaw`DELETE FROM sessions`;
  await testPrisma.$executeRaw`DELETE FROM accounts`;
  await testPrisma.$executeRaw`DELETE FROM users`;
}

/** Test data factories */
export const testData = {
  createUser: async (data?: Partial<{ email: string; name: string }>) => {
    const prisma = getTestPrisma();
    return prisma.user.create({
      data: {
        email: data?.email ?? `test-${Date.now()}@example.com`,
        name: data?.name ?? "Test User",
      },
    });
  },

  createOrganization: async (
    data?: Partial<{ name: string; slug: string }>,
  ) => {
    const prisma = getTestPrisma();
    const slug = data?.slug ?? `org-${Date.now()}`;
    return prisma.organization.create({
      data: {
        name: data?.name ?? "Test Org",
        slug,
      },
    });
  },

  createMembership: async (
    userId: string,
    orgId: string,
    role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER" = "OWNER",
  ) => {
    const prisma = getTestPrisma();
    return prisma.membership.create({
      data: { userId, organizationId: orgId, role },
    });
  },

  createProject: async (
    orgId: string,
    userId: string,
    data?: Partial<{ name: string }>,
  ) => {
    const prisma = getTestPrisma();
    return prisma.project.create({
      data: {
        name: data?.name ?? "Test Project",
        organizationId: orgId,
        createdById: userId,
      },
    });
  },

  createThreatModel: async (
    projectId: string,
    userId: string,
    data?: Partial<{ name: string }>,
  ) => {
    const prisma = getTestPrisma();
    return prisma.threatModel.create({
      data: {
        name: data?.name ?? "Test Model",
        projectId,
        createdById: userId,
      },
    });
  },
};
