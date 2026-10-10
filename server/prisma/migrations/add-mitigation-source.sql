-- D2 — mitigation provenance. Additive, non-destructive.
-- Run ONCE, BEFORE `npx prisma db push` with the new schema on Postgres prod.
--
-- NOT re-runnable after the code deploy. Steps 1 and 2 are idempotent, but the
-- step 3 backfill keys on source='HUMAN', which cannot distinguish "still at the
-- default, never triaged" from "deliberately written HUMAN by the application".
-- Re-running it later would reclassify exactly the residual-error case described
-- below — a person who edited their own mitigation to add test criteria — and
-- move that row into the deletable class.
--
-- WHY THIS EXISTS
-- persistAIThreats cleared a re-analysed threat's mitigations with the predicate
--   threatId + status='NOT_IMPLEMENTED' + verified=false
-- Both of those are the SCHEMA DEFAULTS (see Mitigation.status / .verified), so
-- the predicate matched a hand-written or template-instantiated mitigation in its
-- normal, just-created state. Every AI rerun silently destroyed remediation work
-- that nobody had got around to implementing yet.
--
-- Adds:
--   1. MitigationSource enum (AI | HUMAN)
--   2. mitigations.source (default HUMAN)
--   3. heuristic backfill for pre-existing rows
-- No index: the delete is anchored on threatId, which is already indexed, and a
-- two-valued column does not earn one of its own.
--
-- THE BACKFILL, AND WHY IT IS SAFE
-- Pre-existing rows carry no provenance and it cannot be recovered from
-- createdById (AI writes run as the job's user). The discriminator used instead:
-- the human create path (repositories/mitigation.repository.ts) CANNOT set
-- controlCategory, testCriteria or effectivenessScore — they are absent from
-- CreateMitigationData. Every machine path sets them.
--
-- The other machine writers were checked against the delete predicate directly:
--   * code-scan and GitHub-import controls write status='IMPLEMENTED', so they
--     never matched the predicate and were never at risk.
--   * template instantiation sets NONE of the three fields, so it classifies
--     HUMAN — which is the outcome we want, and it is the only non-AI path that
--     was actually inside the blast radius.
-- So the three-null test does not collide with any non-AI writer.
--
-- Residual error, one case: an AI mitigation where controlCategory, effectiveness
-- and testCriteria all came back empty (each is `x || null` at the write site)
-- classifies HUMAN. That errs toward keeping a stale row rather than deleting a
-- real one, which is the direction we want to be wrong in.
--
-- The column defaults to HUMAN, NOT AI, deliberately: any row inserted between
-- this migration and the code deploy must not land in the deletable class.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. MitigationSource enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MitigationSource') THEN
    CREATE TYPE "MitigationSource" AS ENUM ('AI', 'HUMAN');
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 2. column
-- ---------------------------------------------------------------------------
ALTER TABLE mitigations
  ADD COLUMN IF NOT EXISTS "source" "MitigationSource" NOT NULL DEFAULT 'HUMAN';

-- ---------------------------------------------------------------------------
-- 3. backfill — run once, before the code deploy (see header).
-- ---------------------------------------------------------------------------
UPDATE mitigations
   SET "source" = 'AI'
 WHERE "source" = 'HUMAN'
   AND ("controlCategory"    IS NOT NULL
     OR "testCriteria"       IS NOT NULL
     OR "effectivenessScore" IS NOT NULL);

COMMIT;
