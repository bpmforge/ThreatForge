/**
 * Citation Verifier Backfill
 *
 * Runs citation verification against existing Threat and Mitigation rows
 * that were created before the verifier existed (verificationStatus =
 * PENDING). Idempotent and resumable — can be interrupted and re-run.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-citations.ts --org-id <id> [--dry-run]
 *
 * What it does:
 *   1. Loads every Threat + Mitigation under the given org with
 *      verificationStatus = PENDING and source != MANUAL
 *   2. For each, parses the description for citation tags and runs the
 *      verifier against the org's configured AI provider
 *   3. Skips rows that already have Citation rows written (re-runs are safe)
 *
 * Cost: 1 LLM call per claim with a DOCUMENT citation. REFERENCE and
 * COMPONENT resolutions are free (no LLM call).
 */
import "dotenv/config";
import { getPrisma } from "../db.js";
import { createAIClient } from "../services/ai/client-factory.js";
import type { AISettings } from "../types/settings.js";
import { parseClaim } from "../services/citation/citation-parser.js";
import { verifyClaims } from "../services/citation/citation-verifier.js";
import logger from "../utils/logger.js";

interface Options {
  orgId: string;
  dryRun: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let orgId = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--org-id" && args[i + 1]) {
      orgId = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  if (!orgId) {
    console.error(
      "Usage: npx tsx src/scripts/backfill-citations.ts --org-id <id> [--dry-run]",
    );
    process.exit(2);
  }
  return { orgId, dryRun };
}

async function main(): Promise<void> {
  const opts = parseArgs();
  const prisma = await getPrisma();

  const org = await prisma.organization.findUnique({
    where: { id: opts.orgId },
    select: { id: true, name: true, aiSettings: true },
  });
  if (!org) {
    console.error(`Organization ${opts.orgId} not found`);
    process.exit(3);
  }

  if (!org.aiSettings) {
    console.error(`Organization ${org.name} has no AI settings configured`);
    process.exit(4);
  }

  const settings: AISettings = JSON.parse(org.aiSettings);
  const aiClient = createAIClient(settings, opts.orgId);
  if (!aiClient) {
    console.error("Failed to create AI client from org settings");
    process.exit(5);
  }

  console.log(
    `Backfilling citation verification for org "${org.name}" (${opts.dryRun ? "DRY RUN" : "LIVE"})`,
  );

  // Find all threat models under this org
  const models = await prisma.threatModel.findMany({
    where: { project: { organizationId: opts.orgId } },
    select: { id: true, name: true },
  });
  console.log(`Found ${models.length} threat models to scan`);

  let totalProcessed = 0;
  let totalSkipped = 0;

  for (const model of models) {
    const pendingThreats = await prisma.threat.findMany({
      where: {
        threatModelId: model.id,
        verificationStatus: "PENDING",
        source: { not: "MANUAL" },
      },
      include: { mitigations: true, citations: { select: { id: true } } },
    });

    if (pendingThreats.length === 0) continue;
    console.log(
      `  ${model.name}: ${pendingThreats.length} pending AI-generated threats`,
    );

    for (const threat of pendingThreats) {
      // Idempotency guard: if this threat already has Citation rows,
      // assume the previous run completed and skip.
      if (threat.citations.length > 0) {
        totalSkipped++;
        continue;
      }

      if (opts.dryRun) {
        console.log(`    [dry] would verify threat ${threat.id}`);
        totalProcessed++;
        continue;
      }

      const claims: Parameters<typeof verifyClaims>[3] = [];
      if (threat.description) {
        claims.push({
          ownerType: "threat",
          ownerId: threat.id,
          parsed: parseClaim(threat.description),
        });
      }
      for (const mit of threat.mitigations) {
        if (!mit.description) continue;
        claims.push({
          ownerType: "mitigation",
          ownerId: mit.id,
          parsed: parseClaim(mit.description),
        });
      }

      try {
        const summary = await verifyClaims(prisma, aiClient, model.id, claims);
        console.log(
          `    threat ${threat.id}: ${summary.verified}/${summary.total} verified, ${summary.unverified} unverified, ${summary.phantom} phantom`,
        );
        totalProcessed++;
      } catch (err) {
        logger.error(
          { err, threatId: threat.id },
          "backfill verification failed — skipping",
        );
        totalSkipped++;
      }
    }
  }

  console.log(
    `\nDone. Processed ${totalProcessed} threats, skipped ${totalSkipped}${opts.dryRun ? " (dry run)" : ""}.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
