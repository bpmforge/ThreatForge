-- Challenger Gate (A4-1, ARCHITECTURE §2.4) — additive only.
-- Run BEFORE `npx prisma db push` with the new schema on Postgres prod.
--
-- Adds the adversarial-refutation verdict columns to threats. This is
-- DISTINCT from threats.verificationStatus, which is the citation-rollup
-- field owned by the citation verifier and is left untouched.
--
-- Adds:
--   1. ChallengeStatus enum (UNVERIFIED | CONFIRMED | UNCERTAIN)
--   2. threats.challengeStatus  (default UNVERIFIED)
--   3. threats.verificationNote (nullable refutation rationale)
--   4. index on threats.challengeStatus
--
-- Non-destructive: no rows are deleted or rewritten. Existing rows default
-- to UNVERIFIED.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ChallengeStatus enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChallengeStatus') THEN
    CREATE TYPE "ChallengeStatus" AS ENUM ('UNVERIFIED', 'CONFIRMED', 'UNCERTAIN');
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 2. + 3. columns
-- ---------------------------------------------------------------------------
ALTER TABLE threats
  ADD COLUMN IF NOT EXISTS "challengeStatus" "ChallengeStatus" NOT NULL DEFAULT 'UNVERIFIED';

ALTER TABLE threats
  ADD COLUMN IF NOT EXISTS "verificationNote" TEXT;

-- ---------------------------------------------------------------------------
-- 4. index
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "threats_challengeStatus_idx"
  ON threats ("challengeStatus");

COMMIT;
