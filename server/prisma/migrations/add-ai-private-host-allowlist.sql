-- AI private-host allowlist. Additive, non-destructive, idempotent (safe to re-run).
-- Prod applies schema changes with `npx prisma db push`,
-- which adds these columns itself; this file is the reviewed SQL equivalent for
-- an operator who applies changes by hand, before or after the code deploy.
--
-- WHY THIS EXISTS
-- Org AI settings and AI providers may point the server's AI calls at any URL.
-- Loopback and private-LAN hosts were always allowed (self-hosted LLMs live
-- there), so anyone who could create an organization could aim server-side
-- requests at the internal network. Private hosts are now allowed only when a
-- super-admin lists them here, or turns on the allow-all switch for a
-- single-tenant self-hosted install.
--
-- BEFORE THE CODE DEPLOY: set AI_PRIVATE_HOST_ALLOWLIST on the server to the
-- host of every private AI endpoint already in use (see docs/ADMIN_RUNBOOK.md),
-- or those orgs' AI calls are refused until a super-admin lists the host.
--
-- Adds:
--   system_settings."aiPrivateHostAllowlist"  JSON array of hostnames, IPs, CIDRs
--   system_settings."aiAllowAllPrivateHosts"  default false

BEGIN;

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS "aiPrivateHostAllowlist" TEXT;

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS "aiAllowAllPrivateHosts" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
