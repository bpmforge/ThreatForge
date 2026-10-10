-- "Sign out everywhere" — additive only.
-- `prisma db push` applies this too; the file keeps
-- the change reviewable and safe to run by hand.
--
-- Adds users."sessionsRevokedAt" (nullable). The revoke-all route stamps it,
-- and NextAuth sessions plus server-issued JWTs with an earlier `iat` are
-- rejected. NULL means "never revoked".

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "sessionsRevokedAt" TIMESTAMP(3);

COMMIT;
