-- Scanner findings keyed per project (Wave 1D, item 5).
-- Run BEFORE the deploy's `npx prisma db push` with the new schema.
--
-- scanner_findings was unique on ("scannerType", "externalId") across ALL
-- projects, so importing the same scanner issue into project B overwrote
-- project A's row (another tenant's data). The key becomes
-- ("projectId", "scannerType", "externalId").
--
-- No dedupe is needed: the old key is stricter than the new one, so every
-- existing row already satisfies it. The DO block below proves that before
-- creating the index instead of deleting anything.
--
-- The old index is deliberately left in place: code still running before
-- the deploy upserts ON CONFLICT ("scannerType", "externalId") and needs it.
-- `prisma db push` drops it during the deploy (dropping an index loses no
-- data). Creating the new index here first means db push has no
-- unique-constraint warning to stop on.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM scanner_findings
    GROUP BY "projectId", "scannerType", "externalId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'scanner_findings has duplicate (projectId, scannerType, externalId) rows; resolve them before adding the key';
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "scanner_findings_projectId_scannerType_externalId_key"
  ON scanner_findings ("projectId", "scannerType", "externalId");

COMMIT;
