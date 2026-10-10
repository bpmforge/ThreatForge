/**
 * Backfill documentFamilyId / version / contentHash on existing Document rows,
 * and requirementFamilyId / version on existing Requirement rows.
 *
 * Idempotent — rows with familyId already set are skipped.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-document-versions.ts [--dry-run]
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { getPrisma } from "../db.js";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = await getPrisma();

  const docs = await prisma.document.findMany({
    where: { documentFamilyId: "" },
    select: { id: true, content: true },
  });
  console.log(`Documents needing backfill: ${docs.length}`);

  for (const d of docs) {
    const contentHash = createHash("sha256").update(d.content).digest("hex");
    if (dryRun) continue;
    await prisma.document.update({
      where: { id: d.id },
      data: {
        documentFamilyId: d.id,
        version: 1,
        contentHash,
      },
    });
  }

  const reqs = await prisma.requirement.findMany({
    where: { requirementFamilyId: null },
    select: { id: true },
  });
  console.log(`Requirements needing backfill: ${reqs.length}`);

  for (const r of reqs) {
    if (dryRun) continue;
    await prisma.requirement.update({
      where: { id: r.id },
      data: {
        requirementFamilyId: r.id,
        version: 1,
      },
    });
  }

  console.log(dryRun ? "Dry run complete." : "Backfill complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit(0));
