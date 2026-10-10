/**
 * Shared AI client factory for background job workers.
 */
import { getPrisma } from "../db.js";
import { createAIClient } from "../services/ai/client-factory.js";
import { parseAISettings } from "../types/settings.js";
import type { AISettings } from "../types/settings.js";
import type { AIProviderClient } from "../types/ai.js";

export interface JobAIClient {
  client: AIProviderClient;
  orgSettings: AISettings;
}

/**
 * Build a raw AI provider client for a given organization.
 * Throws if AI is not configured or the client cannot be created.
 */
export async function createJobAIClient(
  organizationId: string,
  prisma?: Awaited<ReturnType<typeof getPrisma>>,
): Promise<JobAIClient> {
  const db = prisma ?? (await getPrisma());
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { aiSettings: true },
  });
  const orgSettings: AISettings = parseAISettings(org?.aiSettings);
  if (!orgSettings?.enabled) throw new Error("AI not configured for org");
  const client = createAIClient(orgSettings, organizationId);
  if (!client) throw new Error("Could not create AI client");
  return { client, orgSettings };
}
