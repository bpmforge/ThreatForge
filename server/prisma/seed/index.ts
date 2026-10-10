/**
 * Database Seed Script
 *
 * Seeds the database with pre-built templates.
 * Run: npx tsx prisma/seed/index.ts
 */
import { ALL_TEMPLATES } from "./templates.js";
import { seedMarketplacePacks } from "./seed-packs.js";

/**
 * ModelTemplate.createdById is required (a template is always attributed to
 * a user). Seeded templates aren't owned by a real person, so find-or-create
 * a stable system user to own them rather than picking an arbitrary existing
 * admin (found in P-01: the original `modelTemplate.create()` omitted this
 * column entirely, so `db:seed` threw `Argument createdBy is missing` on a
 * fresh database).
 */
const SEED_USER_EMAIL = "seed-templates@threatforge.local";

async function getOrCreateSeedUser(
  prisma: Awaited<ReturnType<typeof import("../../src/db.js").getPrisma>>,
): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: SEED_USER_EMAIL },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.user.create({
    data: {
      email: SEED_USER_EMAIL,
      name: "Template Seeder",
    },
    select: { id: true },
  });
  return created.id;
}

async function seed() {
  // Dynamic import to handle both SQLite and PostgreSQL
  const { getPrisma } = await import("../../src/db.js");
  const prisma = await getPrisma();

  const createdById = await getOrCreateSeedUser(prisma);

  console.log(`Seeding ${ALL_TEMPLATES.length} templates...`);

  for (const template of ALL_TEMPLATES) {
    // Check if template already exists (by name)
    const existing = await prisma.modelTemplate.findFirst({
      where: { name: template.name },
    });

    if (existing) {
      console.log(`  Skipping "${template.name}" — already exists`);
      continue;
    }

    // Build canvas state from template components and connections
    const nodes = template.components.map((comp) => ({
      id: comp.id,
      type: "component",
      position: comp.position,
      data: {
        name: comp.name,
        type: comp.type,
        trustLevel: comp.trustLevel || "INTERNAL",
        description: comp.description || "",
      },
    }));

    const edges = template.connections.map((conn) => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      type: "security",
      label: conn.label || "",
      data: {
        protocol: conn.protocol || "HTTPS",
        encrypted: conn.encrypted ?? true,
        authMethod: conn.authMethod || "NONE",
      },
    }));

    const canvasState = JSON.stringify({
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 0.8 },
    });

    // Store threats as JSON for the template
    const templateThreats = JSON.stringify(template.threats);
    const templateBoundaries = JSON.stringify(template.boundaries);

    await prisma.modelTemplate.create({
      data: {
        name: template.name,
        description: template.description,
        canvasState,
        tags: JSON.stringify(template.tags),
        isPublic: true,
        createdById,
        threats: templateThreats,
        boundaries: templateBoundaries,
      },
    });

    console.log(
      `  Created "${template.name}" (${template.components.length} components, ${template.threats.length} threats)`,
    );
  }

  console.log("Seeding community marketplace packs...");
  await seedMarketplacePacks(prisma, createdById);

  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
