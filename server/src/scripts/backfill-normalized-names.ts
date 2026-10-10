/**
 * Threat normalizedName Backfill
 *
 * The dedup key became actor-aware ("Spoofing of A by B" no longer collides
 * with "... B by A"). Only names containing the word "by" produce a different
 * key, so only those rows are recomputed. Idempotent; rows whose new key would
 * collide with an existing row (unique constraint) are left untouched and
 * counted.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-normalized-names.ts [--dry-run]
 */
import "dotenv/config";
import { getPrisma } from "../db.js";
import { normalizeThreatName } from "../services/threat-review/normalize-threat-name.js";

export interface NameRow {
  id: string;
  name: string;
  normalizedName: string | null;
}

/** Rows whose stored key differs from the current normaliser's output. */
export function staleNameUpdates(
  rows: NameRow[],
): Array<{ id: string; normalizedName: string }> {
  const out: Array<{ id: string; normalizedName: string }> = [];
  for (const r of rows) {
    const next = normalizeThreatName(r.name);
    if (next && next !== r.normalizedName) {
      out.push({ id: r.id, normalizedName: next });
    }
  }
  return out;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = await getPrisma();

  const rows = await prisma.threat.findMany({
    where: {
      OR: [
        { name: { contains: " by " } },
        { name: { contains: " By " } },
        { name: { contains: " BY " } },
      ],
    },
    select: { id: true, name: true, normalizedName: true },
  });
  const updates = staleNameUpdates(rows);
  console.log(`${rows.length} candidate rows, ${updates.length} stale`);

  let updated = 0;
  let collided = 0;
  for (const u of updates) {
    if (dryRun) continue;
    try {
      await prisma.threat.update({
        where: { id: u.id },
        data: { normalizedName: u.normalizedName },
      });
      updated++;
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") collided++;
      else throw err;
    }
  }
  console.log(
    dryRun
      ? "dry run — no changes written"
      : `updated ${updated}, skipped ${collided} (key collision)`,
  );
  await prisma.$disconnect();
}

// Only run when executed directly, so the pure helper stays importable in tests.
if (process.argv[1]?.endsWith("backfill-normalized-names.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
