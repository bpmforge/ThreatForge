/**
 * Seeds the public community packs (see packs.ts) into the marketplace.
 *
 * Idempotent: a pack is skipped when a library with its name already exists in
 * the community org. Every row is attributed to `createdById` (a real user
 * row) so the seed never trips a required-author constraint on a fresh DB.
 */
import type { PrismaClient } from "@prisma/client";
import { COMMUNITY_PACKS, type CommunityPack } from "./packs.js";

const COMMUNITY_ORG_SLUG = "threatforge-community";
const PACK_VERSION = "1.0.0";

async function getOrCreateCommunityOrg(
  prisma: PrismaClient,
  ownerId: string,
): Promise<string> {
  const existing = await prisma.organization.findUnique({
    where: { slug: COMMUNITY_ORG_SLUG },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.organization.create({
    data: {
      name: "ThreatForge Community",
      slug: COMMUNITY_ORG_SLUG,
      description: "Curated community threat and mitigation packs.",
      ownerId,
    },
    select: { id: true },
  });
  return created.id;
}

async function seedPack(
  prisma: PrismaClient,
  pack: CommunityPack,
  organizationId: string,
  createdById: string,
): Promise<boolean> {
  const existing = await prisma.mitigationLibrary.findFirst({
    where: { organizationId, name: pack.name },
    select: { id: true },
  });
  if (existing) return false;

  const mitigationLibrary = await prisma.mitigationLibrary.create({
    data: {
      organizationId,
      name: pack.name,
      description: pack.description,
      isPublic: true,
      createdById,
    },
  });

  // Reverse index: mitigation name -> threats it applies to.
  const threatsByMitigation = new Map<string, string[]>();
  for (const threat of pack.threats) {
    for (const m of threat.mitigations) {
      threatsByMitigation.set(m, [
        ...(threatsByMitigation.get(m) ?? []),
        threat.name,
      ]);
    }
  }

  for (const m of pack.mitigations) {
    await prisma.mitigationTemplate.create({
      data: {
        libraryId: mitigationLibrary.id,
        name: m.name,
        description: m.description,
        strategy: m.strategy,
        effort: m.effort,
        effectiveness: m.effectiveness,
        applicableThreatTypes: JSON.stringify(
          threatsByMitigation.get(m.name) ?? [],
        ),
        implementationSteps: JSON.stringify(m.steps),
        tags: JSON.stringify(m.tags),
        createdById,
      },
    });
  }

  const threatLibrary = await prisma.threatLibrary.create({
    data: {
      organizationId,
      name: pack.name,
      description: pack.description,
      isPublic: true,
    },
  });

  for (const t of pack.threats) {
    await prisma.threatTemplate.create({
      data: {
        libraryId: threatLibrary.id,
        name: t.name,
        description: t.description,
        strideCategory: t.stride,
        defaultSeverity: t.severity,
        applicableComponentTypes: JSON.stringify(t.componentTypes),
        suggestedMitigations: JSON.stringify(t.mitigations),
        cweIds: JSON.stringify(t.cweIds),
        owaspIds: JSON.stringify(t.owaspIds),
      },
    });
  }

  for (const [libraryType, libraryId] of [
    ["MITIGATION_LIBRARY", mitigationLibrary.id],
    ["THREAT_LIBRARY", threatLibrary.id],
  ] as const) {
    await prisma.libraryPublication.create({
      data: {
        libraryType,
        libraryId,
        sourceOrgId: organizationId,
        version: PACK_VERSION,
        status: "APPROVED",
        requestedById: createdById,
        approvedById: createdById,
        approvedAt: new Date(),
      },
    });
  }

  return true;
}

/** Returns the number of packs newly created. */
export async function seedMarketplacePacks(
  prisma: PrismaClient,
  createdById: string,
): Promise<number> {
  const organizationId = await getOrCreateCommunityOrg(prisma, createdById);
  let created = 0;
  for (const pack of COMMUNITY_PACKS) {
    if (await seedPack(prisma, pack, organizationId, createdById)) {
      created++;
      console.log(
        `  Created pack "${pack.name}" (${pack.threats.length} threats, ${pack.mitigations.length} mitigations)`,
      );
    } else {
      console.log(`  Skipping pack "${pack.name}" — already exists`);
    }
  }
  return created;
}
