/**
 * External-enrichment gate.
 *
 * CVE/EPSS enrichment makes outbound calls to OSV and FIRST. Air-gapped /
 * data-sensitive orgs set aiRoutingPolicy = "local-only" — they must not make
 * these calls either. This reuses the same policy that Phase 0 enforces for
 * LLM routing rather than introducing a new config flag.
 */
import { getPrisma } from "../../db.js";

export async function isExternalEnrichmentAllowed(
  threatModelId: string,
): Promise<boolean> {
  const prisma = await getPrisma();
  const model = await prisma.threatModel.findUnique({
    where: { id: threatModelId },
    select: {
      project: {
        select: { organization: { select: { aiRoutingPolicy: true } } },
      },
    },
  });
  const policy = model?.project?.organization?.aiRoutingPolicy ?? "allow-cloud";
  return policy !== "local-only";
}
