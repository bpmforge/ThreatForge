/**
 * Seed a SECOND, distinct user for the two-session collaboration e2e spec
 * (`frontend/e2e/authenticated/collab-x6.spec.ts`).
 *
 * Why a distinct user (not just a 2nd login as the admin): a second login as the
 * SAME user rotates/invalidates the first session, so the two browser contexts
 * the collab test drives must authenticate as different users. This idempotently
 * upserts that user and gives it EDITOR membership in the first organisation
 * (the one `setup:cli` created) so it can open models created by the admin.
 *
 * Run AFTER `setup:cli` (needs the org to exist). Idempotent — safe to re-run.
 *
 *   npm run seed:collab-user
 *   COLLAB_USER_EMAIL=... COLLAB_USER_PASSWORD=... npm run seed:collab-user
 *
 * Exit codes: 0 = ok, 3 = no organisation (run setup:cli first), 1 = error.
 */
import "dotenv/config";
import { getPrisma } from "../db.js";
import bcrypt from "bcryptjs";

async function main(): Promise<void> {
  const email = process.env.COLLAB_USER_EMAIL || "collab2@example.com";
  // Fail closed: never mint an account with a hardcoded default password.
  // Require the caller to supply COLLAB_USER_PASSWORD explicitly.
  const password = process.env.COLLAB_USER_PASSWORD;
  if (!password) {
    console.error(
      "COLLAB_USER_PASSWORD is required — refusing to seed a collab user with a default password.",
    );
    process.exit(2);
  }
  const name = process.env.COLLAB_USER_NAME || "Collab Two";

  const prisma = await getPrisma();

  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!org) {
    console.error(
      "No organisation found — run `npm run setup:cli` before seeding the collab user.",
    );
    process.exit(3);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, emailVerified: new Date() },
  });

  // nosemgrep: tf-membership-query-missing-status -- seed script: any existing row blocks a duplicate
  const existing = await prisma.membership.findFirst({
    where: { userId: user.id, organizationId: org.id },
  });
  if (!existing) {
    await prisma.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "EDITOR" },
    });
  }

  console.log(
    JSON.stringify({ ok: true, email, userId: user.id, orgId: org.id }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
