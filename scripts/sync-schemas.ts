#!/usr/bin/env npx tsx
/**
 * Schema Sync Utility
 *
 * Generates the frontend Prisma schema from the backend's modular schema files.
 * The backend schema (server/prisma/schema/*.prisma) is the single source of truth.
 *
 * Usage:
 *   npx tsx scripts/sync-schemas.ts
 *   npm run schema:sync
 *
 * What it does:
 * 1. Reads all *.prisma files from server/prisma/schema/
 * 2. Extracts model/enum definitions (skips generator/datasource blocks)
 * 3. Prepends the frontend-specific config (with driverAdapters)
 * 4. Writes the combined schema to frontend/prisma/schema.prisma
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const SERVER_SCHEMA_DIR = path.join(ROOT_DIR, "server/prisma/schema");
const FRONTEND_SCHEMA_PATH = path.join(
  ROOT_DIR,
  "frontend/prisma/schema.prisma",
);
// The container/prod build (frontend/Dockerfile) copies this Postgres variant over
// schema.prisma before `prisma generate`, so it MUST be generated here too — a
// hand-maintained copy silently rots and the prod client drifts from the DB.
const FRONTEND_PG_SCHEMA_PATH = path.join(
  ROOT_DIR,
  "frontend/prisma/schema.postgresql.prisma",
);

// Frontend-specific config (includes driverAdapters for SQLite/PostgreSQL support).
// The two variants differ ONLY in the datasource provider; model/enum bodies are
// identical, copied verbatim from the server source of truth.
function frontendConfig(provider: "sqlite" | "postgresql"): string {
  return `// Prisma Schema for ThreatForge
// AUTO-GENERATED from server/prisma/schema/*.prisma
// Do not edit directly - run \`npm run schema:sync\` to regenerate

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "${provider}"
}

`;
}

/**
 * Check if a line is part of generator/datasource block
 */
function isConfigLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("generator ") ||
    trimmed.startsWith("datasource ") ||
    trimmed.startsWith("provider") ||
    trimmed.startsWith("previewFeatures")
  );
}

/**
 * Extract model/enum content from a schema file, skipping config blocks
 */
function extractSchemaContent(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const result: string[] = [];
  let inConfigBlock = false;
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip file-level comments at the start
    if (result.length === 0 && trimmed.startsWith("//")) {
      continue;
    }

    // Detect start of generator/datasource block
    if (trimmed.startsWith("generator ") || trimmed.startsWith("datasource ")) {
      inConfigBlock = true;
      braceDepth = 0;
    }

    if (inConfigBlock) {
      // Count braces to know when block ends
      for (const char of line) {
        if (char === "{") braceDepth++;
        if (char === "}") braceDepth--;
      }
      if (braceDepth <= 0 && line.includes("}")) {
        inConfigBlock = false;
      }
      continue; // Skip this line
    }

    // Skip empty lines at the start
    if (result.length === 0 && trimmed === "") {
      continue;
    }

    result.push(line);
  }

  // Trim trailing empty lines
  while (result.length > 0 && result[result.length - 1].trim() === "") {
    result.pop();
  }

  return result.join("\n");
}

/**
 * Get all schema files in sorted order
 */
function getSchemaFiles(): string[] {
  const files = fs
    .readdirSync(SERVER_SCHEMA_DIR)
    .filter((f) => f.endsWith(".prisma"))
    .sort(); // Files are numbered: 00-config.prisma, 01-user.prisma, etc.

  return files.map((f) => path.join(SERVER_SCHEMA_DIR, f));
}

/**
 * Main sync function
 */
function syncSchemas(): void {
  console.log("Schema Sync Utility");
  console.log("=".repeat(50));
  console.log(`Source: ${SERVER_SCHEMA_DIR}`);
  console.log(`Target: ${FRONTEND_SCHEMA_PATH}`);
  console.log("");

  // Check source directory exists
  if (!fs.existsSync(SERVER_SCHEMA_DIR)) {
    console.error(
      `Error: Server schema directory not found: ${SERVER_SCHEMA_DIR}`,
    );
    process.exit(1);
  }

  const schemaFiles = getSchemaFiles();
  console.log(`Found ${schemaFiles.length} schema files:`);
  schemaFiles.forEach((f) => console.log(`  - ${path.basename(f)}`));
  console.log("");

  // Extract content from each file
  const contents: string[] = [];
  for (const filePath of schemaFiles) {
    const fileName = path.basename(filePath);
    const content = extractSchemaContent(filePath);

    if (content.trim()) {
      // Add section header comment
      contents.push(
        `// =============================================================================`,
      );
      contents.push(`// From: ${fileName}`);
      contents.push(
        `// =============================================================================`,
      );
      contents.push("");
      contents.push(content);
      contents.push("");
    }
  }

  // Shared model/enum body, copied verbatim from the server source of truth.
  const body = contents.join("\n");

  // Ensure target directory exists
  const targetDir = path.dirname(FRONTEND_SCHEMA_PATH);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Write both variants — dev/desktop (SQLite) and container/prod (PostgreSQL).
  // Both must stay in lockstep; the prod Docker build generates its client from
  // the PostgreSQL variant.
  const sqliteSchema = frontendConfig("sqlite") + body;
  const pgSchema = frontendConfig("postgresql") + body;
  fs.writeFileSync(FRONTEND_SCHEMA_PATH, sqliteSchema, "utf-8");
  fs.writeFileSync(FRONTEND_PG_SCHEMA_PATH, pgSchema, "utf-8");

  // Count models and enums
  const modelCount = (sqliteSchema.match(/^model \w+/gm) || []).length;
  const enumCount = (sqliteSchema.match(/^enum \w+/gm) || []).length;

  console.log("Schema synced successfully!");
  console.log(`  Models: ${modelCount}`);
  console.log(`  Enums:  ${enumCount}`);
  console.log(`  Output: ${FRONTEND_SCHEMA_PATH}`);
  console.log(`  Output: ${FRONTEND_PG_SCHEMA_PATH}`);
  console.log("");
  console.log("Next steps:");
  console.log("  cd frontend && npx prisma generate");
}

// Run if called directly
syncSchemas();
