-- Password reset ends existing sessions (Wave 1D, item 1) — additive only.
-- `prisma db push` applies this too; the file keeps
-- the change reviewable and safe to run by hand.
--
-- Adds users."passwordChangedAt" (nullable). The reset handler stamps it, and
-- NextAuth sessions plus server-issued JWTs with an earlier `iat` are rejected.
-- Existing rows stay NULL, which means "never reset" and rejects nothing.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

COMMIT;
