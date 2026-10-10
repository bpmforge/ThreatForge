-- Mitigation Status Model Redesign
-- Run BEFORE prisma db push with the new schema
--
-- Changes:
--   1. MitigationStatus enum: PLANNED/IN_PROGRESS/COMPLETED/VERIFIED → NOT_IMPLEMENTED/IMPLEMENTED
--   2. New column: verified (boolean, default false)
--   3. New column: obligation (enum REQUIRED/RECOMMENDED, default RECOMMENDED)

BEGIN;

-- Step 1: Add new columns
ALTER TABLE mitigations ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Create the obligation enum and column
DO $$ BEGIN
  CREATE TYPE "MitigationObligation" AS ENUM ('REQUIRED', 'RECOMMENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE mitigations ADD COLUMN IF NOT EXISTS obligation "MitigationObligation" NOT NULL DEFAULT 'RECOMMENDED';

-- Step 3: Set verified based on current status (before we lose the old values)
UPDATE mitigations SET verified = true WHERE status = 'VERIFIED';

-- Step 4: Convert column to text temporarily so we can set new values
ALTER TABLE mitigations ALTER COLUMN status DROP DEFAULT;
ALTER TABLE mitigations ALTER COLUMN status TYPE TEXT USING status::TEXT;

-- Step 5: Update values
UPDATE mitigations SET status = 'NOT_IMPLEMENTED' WHERE status IN ('PLANNED', 'IN_PROGRESS');
UPDATE mitigations SET status = 'IMPLEMENTED' WHERE status IN ('COMPLETED', 'VERIFIED');

-- Step 6: Create new enum and convert column back
DO $$ BEGIN
  CREATE TYPE "MitigationStatus_new" AS ENUM ('NOT_IMPLEMENTED', 'IMPLEMENTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE mitigations
  ALTER COLUMN status TYPE "MitigationStatus_new" USING status::"MitigationStatus_new",
  ALTER COLUMN status SET DEFAULT 'NOT_IMPLEMENTED';

-- Step 7: Drop old enum and rename new one
DROP TYPE IF EXISTS "MitigationStatus";
ALTER TYPE "MitigationStatus_new" RENAME TO "MitigationStatus";

COMMIT;
