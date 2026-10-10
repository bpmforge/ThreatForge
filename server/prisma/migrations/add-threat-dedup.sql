-- Threat Dedup + Session Tracking + Job Mutex
-- Run BEFORE `npx prisma db push` with the new schema.
--
-- Destructive: wipes AI_SUGGESTED PENDING threats so the unique constraint
-- can be applied cleanly. Human-reviewed and manually-edited threats are
-- preserved.
--
-- Adds:
--   1. threats.analysisSessionId (T1.2) — tag rows with aiJob.id that created them
--   2. threats.normalizedName (T1.1) — paraphrase-normalized dedup key
--   3. threats unique index on (threatModelId, targetKey, normalizedName)
--      where targetKey = COALESCE(componentNodeId, connectionEdgeId, '__compound__')
--   4. ai_jobs partial unique index (T2.1) — one active SUGGEST_THREATS per model

BEGIN;

-- ---------------------------------------------------------------------------
-- T1.2 — analysisSessionId column
-- ---------------------------------------------------------------------------
ALTER TABLE threats
  ADD COLUMN IF NOT EXISTS "analysisSessionId" TEXT;

CREATE INDEX IF NOT EXISTS "threats_analysisSessionId_idx"
  ON threats ("analysisSessionId");

-- ---------------------------------------------------------------------------
-- T1.1 — normalizedName column + cleanup + unique constraint
-- ---------------------------------------------------------------------------
ALTER TABLE threats
  ADD COLUMN IF NOT EXISTS "normalizedName" TEXT;

-- Destructive wipe: remove AI-generated PENDING threats that have never
-- been reviewed/edited. Safe because the user approved "start fresh on prod."
-- Keeps MANUAL threats, ACCEPTED/MODIFIED/REJECTED threats, and any row
-- where manuallyEdited = true.
DELETE FROM threats
 WHERE source = 'AI_SUGGESTED'
   AND "reviewStatus" = 'PENDING'
   AND "manuallyEdited" = false;

-- Backfill normalizedName for surviving (kept) rows using a simple
-- lowercase-sort-tokens function. The application writes the richer
-- normalizeThreatName() output on every subsequent INSERT/UPDATE, but
-- this gets surviving rows under a stable key so the unique constraint
-- can be applied.
UPDATE threats
   SET "normalizedName" = regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g')
 WHERE "normalizedName" IS NULL;

-- Surface collisions on the kept (human-reviewed) rows before adding the
-- constraint. If this query returns any rows, resolve manually: typically
-- keep the highest-confidence or most-recently-edited row.
DO $$
DECLARE
  dup_count INT;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT "threatModelId",
           COALESCE("componentNodeId", "connectionEdgeId", '__compound__') AS target_key,
           "normalizedName",
           COUNT(*) AS n
      FROM threats
     WHERE "normalizedName" IS NOT NULL
     GROUP BY 1, 2, 3
    HAVING COUNT(*) > 1
  ) c;
  IF dup_count > 0 THEN
    RAISE NOTICE 'WARNING: % collision groups on surviving threats — resolve before adding unique constraint.', dup_count;
  END IF;
END $$;

-- Unique constraint across all three attach types (component, connection,
-- compound) using a functional index with COALESCE to avoid Postgres's
-- "NULLs are distinct" gap. `__compound__` is a reserved sentinel.
CREATE UNIQUE INDEX IF NOT EXISTS "threats_dedup_unique_idx"
  ON threats (
    "threatModelId",
    COALESCE("componentNodeId", "connectionEdgeId", '__compound__'),
    "normalizedName"
  )
  WHERE "normalizedName" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- T2.1 — Per-model SUGGEST_THREATS job mutex
-- ---------------------------------------------------------------------------
-- Partial unique index: at most one QUEUED or PROCESSING SUGGEST_THREATS
-- job per threat model. A concurrent INSERT fails with SQLSTATE 23505 which
-- the app catches and returns as 409 Conflict to the client.
CREATE UNIQUE INDEX IF NOT EXISTS "ai_jobs_one_active_suggest_per_model_idx"
  ON ai_jobs ("threatModelId")
  WHERE status IN ('QUEUED', 'PROCESSING')
    AND type = 'SUGGEST_THREATS'
    AND "threatModelId" IS NOT NULL;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification queries — run these after commit to confirm state:
-- ---------------------------------------------------------------------------
--
-- SELECT COUNT(*) AS total_threats,
--        COUNT(*) FILTER (WHERE "analysisSessionId" IS NOT NULL) AS tagged,
--        COUNT(*) FILTER (WHERE "normalizedName" IS NOT NULL) AS normalized
--   FROM threats;
--
-- SELECT indexname FROM pg_indexes
--  WHERE tablename IN ('threats', 'ai_jobs')
--    AND indexname LIKE '%dedup%' OR indexname LIKE '%one_active%';
