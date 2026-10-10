/**
 * Per-Request Access Cache
 *
 * Caches access check results within a single request to avoid
 * repeated deep JOINs (user → membership → org → project → model).
 *
 * Usage in route handlers:
 *   const cache = getAccessCache(request);
 *   const hasAccess = await cache.canAccessThreatModel(userId, modelId);
 *   // Second call with same args returns cached result
 */
import type { FastifyRequest } from "fastify";
import { getPrisma } from "../db.js";

interface AccessCacheEntry {
  hasAccess: boolean;
  organizationId?: string;
}

const REQUEST_CACHE_KEY = Symbol("accessCache");

export class AccessCache {
  private cache = new Map<string, AccessCacheEntry>();

  private key(
    userId: string,
    resourceType: string,
    resourceId: string,
  ): string {
    return `${userId}:${resourceType}:${resourceId}`;
  }

  async canAccessThreatModel(
    userId: string,
    threatModelId: string,
  ): Promise<boolean> {
    const k = this.key(userId, "threatModel", threatModelId);
    const cached = this.cache.get(k);
    if (cached !== undefined) return cached.hasAccess;

    const prisma = await getPrisma();
    const model = await prisma.threatModel.findUnique({
      where: { id: threatModelId },
      select: {
        project: {
          select: {
            organization: {
              select: {
                memberships: {
                  where: { userId, status: "ACTIVE" },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    const hasAccess = (model?.project.organization.memberships.length ?? 0) > 0;
    this.cache.set(k, { hasAccess });
    return hasAccess;
  }

  async canAccessProject(userId: string, projectId: string): Promise<boolean> {
    const k = this.key(userId, "project", projectId);
    const cached = this.cache.get(k);
    if (cached !== undefined) return cached.hasAccess;

    const prisma = await getPrisma();
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        organization: {
          select: {
            memberships: {
              where: { userId, status: "ACTIVE" },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    const hasAccess = (project?.organization.memberships.length ?? 0) > 0;
    this.cache.set(k, { hasAccess });
    return hasAccess;
  }
}

/**
 * Get or create an AccessCache for this request.
 * Cache lives only for the duration of the request.
 */
export function getAccessCache(request: FastifyRequest): AccessCache {
  const existing = (request as unknown as Record<symbol, unknown>)[
    REQUEST_CACHE_KEY
  ];
  if (existing instanceof AccessCache) return existing;

  const cache = new AccessCache();
  (request as unknown as Record<symbol, unknown>)[REQUEST_CACHE_KEY] = cache;
  return cache;
}
