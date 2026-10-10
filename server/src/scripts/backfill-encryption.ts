/**
 * Backfill Encryption Script
 *
 * Encrypts all existing plaintext sensitive fields in the database
 * after ENCRYPT_AT_REST=true is enabled.
 *
 * Safe to run multiple times — already-encrypted values are detected
 * and skipped. Processes in batches to avoid memory pressure.
 *
 * Usage:
 *   ENCRYPT_AT_REST=true npx tsx src/scripts/backfill-encryption.ts
 *   ENCRYPT_AT_REST=true npx tsx src/scripts/backfill-encryption.ts --dry-run
 *
 * Options:
 *   --dry-run    Count affected rows without writing
 *   --batch-size Number of records per batch (default: 100)
 */
import "dotenv/config";
import { getPrisma } from "../db.js";
import { encryptField, decryptField } from "../middleware/field-encryption.js";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE =
  parseInt(
    process.argv.find((a) => a.startsWith("--batch-size="))?.split("=")[1] ??
      "",
  ) || 100;

if (process.env.ENCRYPT_AT_REST !== "true") {
  console.error(
    "Error: ENCRYPT_AT_REST=true must be set before running this script.",
  );
  process.exit(1);
}

function isEncryptedJson(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const p = JSON.parse(value);
    return (
      p && typeof p === "object" && "algorithm" in p && "iv" in p && "data" in p
    );
  } catch {
    return false;
  }
}

interface BatchResult {
  processed: number;
  encrypted: number;
  skipped: number;
  errors: number;
}

async function backfillThreatModels(
  prisma: Awaited<ReturnType<typeof getPrisma>>,
): Promise<BatchResult> {
  const result: BatchResult = {
    processed: 0,
    encrypted: 0,
    skipped: 0,
    errors: 0,
  };
  let cursor: string | undefined;

  console.log("\n[ThreatModel.canvasState]");
  while (true) {
    const rows = await (prisma as any).threatModel.findMany({
      select: { id: true, canvasState: true },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      result.processed++;
      if (!row.canvasState || isEncryptedJson(row.canvasState)) {
        result.skipped++;
        continue;
      }
      if (DRY_RUN) {
        result.encrypted++;
        continue;
      }
      try {
        await (prisma as any).threatModel.update({
          where: { id: row.id },
          data: { canvasState: encryptField(row.canvasState) },
        });
        result.encrypted++;
      } catch (err) {
        console.error(`  Error on threatModel ${row.id}:`, err);
        result.errors++;
      }
    }
  }
  console.log(
    `  processed=${result.processed} encrypted=${result.encrypted} skipped=${result.skipped} errors=${result.errors}`,
  );
  return result;
}

async function backfillThreats(
  prisma: Awaited<ReturnType<typeof getPrisma>>,
): Promise<BatchResult> {
  const result: BatchResult = {
    processed: 0,
    encrypted: 0,
    skipped: 0,
    errors: 0,
  };
  const fields = ["description", "evidence", "attackVector"] as const;
  let cursor: string | undefined;

  console.log("\n[Threat: description, evidence, attackVector]");
  while (true) {
    const rows = await (prisma as any).threat.findMany({
      select: {
        id: true,
        description: true,
        evidence: true,
        attackVector: true,
      },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      result.processed++;
      const update: Record<string, string> = {};
      for (const field of fields) {
        const val = row[field];
        if (val && !isEncryptedJson(val)) {
          update[field] = encryptField(val) as string;
        }
      }
      if (!Object.keys(update).length) {
        result.skipped++;
        continue;
      }
      if (DRY_RUN) {
        result.encrypted++;
        continue;
      }
      try {
        await (prisma as any).threat.update({
          where: { id: row.id },
          data: update,
        });
        result.encrypted++;
      } catch (err) {
        console.error(`  Error on threat ${row.id}:`, err);
        result.errors++;
      }
    }
  }
  console.log(
    `  processed=${result.processed} encrypted=${result.encrypted} skipped=${result.skipped} errors=${result.errors}`,
  );
  return result;
}

async function backfillMitigations(
  prisma: Awaited<ReturnType<typeof getPrisma>>,
): Promise<BatchResult> {
  const result: BatchResult = {
    processed: 0,
    encrypted: 0,
    skipped: 0,
    errors: 0,
  };
  const fields = [
    "description",
    "implementationNotes",
    "testCriteria",
  ] as const;
  let cursor: string | undefined;

  console.log("\n[Mitigation: description, implementationNotes, testCriteria]");
  while (true) {
    const rows = await (prisma as any).mitigation.findMany({
      select: {
        id: true,
        description: true,
        implementationNotes: true,
        testCriteria: true,
      },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      result.processed++;
      const update: Record<string, string> = {};
      for (const field of fields) {
        const val = row[field];
        if (val && !isEncryptedJson(val)) {
          update[field] = encryptField(val) as string;
        }
      }
      if (!Object.keys(update).length) {
        result.skipped++;
        continue;
      }
      if (DRY_RUN) {
        result.encrypted++;
        continue;
      }
      try {
        await (prisma as any).mitigation.update({
          where: { id: row.id },
          data: update,
        });
        result.encrypted++;
      } catch (err) {
        console.error(`  Error on mitigation ${row.id}:`, err);
        result.errors++;
      }
    }
  }
  console.log(
    `  processed=${result.processed} encrypted=${result.encrypted} skipped=${result.skipped} errors=${result.errors}`,
  );
  return result;
}

async function backfillDocuments(
  prisma: Awaited<ReturnType<typeof getPrisma>>,
): Promise<BatchResult> {
  const result: BatchResult = {
    processed: 0,
    encrypted: 0,
    skipped: 0,
    errors: 0,
  };
  let cursor: string | undefined;

  console.log("\n[Document.content]");
  while (true) {
    const rows = await (prisma as any).document.findMany({
      select: { id: true, content: true },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      result.processed++;
      if (!row.content || isEncryptedJson(row.content)) {
        result.skipped++;
        continue;
      }
      if (DRY_RUN) {
        result.encrypted++;
        continue;
      }
      try {
        await (prisma as any).document.update({
          where: { id: row.id },
          data: { content: encryptField(row.content) },
        });
        result.encrypted++;
      } catch (err) {
        console.error(`  Error on document ${row.id}:`, err);
        result.errors++;
      }
    }
  }
  console.log(
    `  processed=${result.processed} encrypted=${result.encrypted} skipped=${result.skipped} errors=${result.errors}`,
  );
  return result;
}

async function main() {
  console.log(`ThreatForge Encryption Backfill ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(
    "ENCRYPT_AT_REST:",
    process.env.ENCRYPT_AT_REST,
    "| ENCRYPTION_KEY set:",
    !!process.env.ENCRYPTION_KEY,
  );

  // Raw prisma — bypass the encryption middleware so we read plaintext
  // and write already-encrypted values without double-encrypting.
  // We call encryptField() ourselves on each row.
  const prisma = (await getPrisma()) as any;

  // Sanity check: verify encryption key works by round-tripping a value
  const test = encryptField("ping");
  if (decryptField(test) !== "ping") {
    console.error("Encryption round-trip sanity check FAILED. Aborting.");
    process.exit(1);
  }
  console.log("Encryption round-trip: OK");

  const totals: BatchResult = {
    processed: 0,
    encrypted: 0,
    skipped: 0,
    errors: 0,
  };

  const add = (r: BatchResult) => {
    totals.processed += r.processed;
    totals.encrypted += r.encrypted;
    totals.skipped += r.skipped;
    totals.errors += r.errors;
  };

  add(await backfillThreatModels(prisma));
  add(await backfillThreats(prisma));
  add(await backfillMitigations(prisma));
  add(await backfillDocuments(prisma));

  console.log("\n=== Backfill Summary ===");
  console.log(`  Total processed : ${totals.processed}`);
  console.log(`  Encrypted       : ${totals.encrypted}`);
  console.log(`  Already skipped : ${totals.skipped}`);
  console.log(`  Errors          : ${totals.errors}`);

  if (DRY_RUN) {
    console.log("\nDry run complete. No rows were modified.");
  } else if (totals.errors > 0) {
    console.error(
      `\nCompleted with ${totals.errors} error(s). Check logs above.`,
    );
    process.exit(1);
  } else {
    console.log("\nBackfill complete.");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
