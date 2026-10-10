-- NVD API key as a super-admin setting (encrypted). Additive only; the
-- deploy's `prisma db push` applies it too. NULL = use NVD_API_KEY from the
-- environment, or no key.
BEGIN;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS "nvdApiKey" TEXT;
COMMIT;
