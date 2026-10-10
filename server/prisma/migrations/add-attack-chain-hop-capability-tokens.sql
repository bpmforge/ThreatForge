-- Attack-chain capability tokens (A5-1, ARCHITECTURE §2.5) — additive only.
-- Run BEFORE `npx prisma db push` with the new schema on Postgres prod.
--
-- Adds the preconditions→yields capability-token columns to attack_chain_hops.
-- Pass-4 chain validation (code, not LLM) checks
--   preconditions(hop i+1) ⊆ {entry assumptions} ∪ yields(hops 1..i)
-- plus an edge-path check on canvasState.
--
-- Storage: JSON-encoded string arrays in a TEXT column, NOT a native Postgres
-- text[]. This is deliberate and matches the rest of the schema: the datasource
-- is SQLite for dev/desktop (no native String[]), so every array-ish field in
-- ThreatForge (mitigationIds here, scanners.cweIds/cveIds, prompts.variables,
-- reviews.checklist, …) is persisted as a JSON string and (de)serialized at the
-- app boundary, where zod validates it as z.array(z.string()). Using TEXT keeps
-- the single Prisma schema applying identically on SQLite (db push) and Postgres.
--
-- Non-destructive: no rows are deleted or rewritten. Existing hops default to
-- empty arrays ('[]').

BEGIN;

ALTER TABLE attack_chain_hops
  ADD COLUMN IF NOT EXISTS "preconditions" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE attack_chain_hops
  ADD COLUMN IF NOT EXISTS "yields" TEXT NOT NULL DEFAULT '[]';

COMMIT;
