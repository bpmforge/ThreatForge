/**
 * Prisma 7 Configuration
 *
 * This file configures database connections for Prisma CLI commands
 * (migrate, db push, studio, etc.) which require a direct database URL.
 *
 * Runtime connections use adapters configured in src/db.ts
 *
 * For SQLite (default):
 *   DATABASE_URL=file:./data/app.db
 *
 * For PostgreSQL:
 *   DATABASE_URL=postgresql://user:password@host:5432/dbname
 */
import "dotenv/config";
import path from "path";
import { defineConfig } from "prisma/config";

// Get database URL from environment or use default SQLite for build/generate
const databaseUrl =
  process.env.DATABASE_URL ||
  `file:${path.join(process.cwd(), "data", "dev.db")}`;

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
