/**
 * Threat Repository
 *
 * Data access layer for threats with pagination support.
 */

import type { Severity, ThreatStatus, Prisma } from "@prisma/client";
import {
  getPrisma,
  type PaginationParams,
  type PaginatedResult,
  normalizePagination,
  buildPaginatedResult,
  NotFoundError,
} from "./base.js";

export interface ThreatListParams extends PaginationParams {
  threatModelId: string;
  severity?: Severity;
  status?: ThreatStatus;
  strideCategory?: string;
  search?: string;
  sortBy?: "severity" | "createdAt" | "name";
  sortOrder?: "asc" | "desc";
  /**
   * Filter to threats created or updated AFTER this timestamp.
   * Used by the "changes since last sign-off" view (#61) — pass the most
   * recent attestation's `attestedAt` to see what's new for re-review.
   */
  since?: Date;
}

export interface ThreatData {
  id: string;
  name: string;
  description: string | null;
  strideCategories: string[];
  severity: string;
  status: string;
  componentNodeId: string | null;
  connectionEdgeId: string | null;
  threatModelId: string;
  createdAt: Date;
  updatedAt: Date;
  mitigations: unknown[];
}

export interface CreateThreatData {
  name: string;
  description?: string;
  strideCategories: string[];
  severity: Severity;
  threatModelId: string;
  componentNodeId?: string;
  connectionEdgeId?: string;
  createdById: string;
}

export interface UpdateThreatData {
  name?: string;
  description?: string;
  strideCategories?: string[];
  severity?: Severity;
  status?: ThreatStatus;
  manuallyEdited?: boolean;
  assigneeId?: string | null;
  likelihood?: number | null; // 0.0–1.0; for business risk scoring
}

/** Parse JSON string fields on a raw mitigation row */
function parseMitigationJson(
  m: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...m,
    evidenceLinks: (() => {
      try {
        return JSON.parse((m.evidenceLinks as string) || "[]");
      } catch {
        return [];
      }
    })(),
    requirementRefs: (() => {
      try {
        return JSON.parse((m.requirementRefs as string) || "[]");
      } catch {
        return [];
      }
    })(),
  };
}

/** Helper to parse strideCategories from DB JSON string and add mitigations */
function parseThreat<
  T extends { strideCategories: string; mitigations?: unknown[] },
>(
  threat: T,
): Omit<T, "strideCategories"> & {
  strideCategories: string[];
  mitigations: unknown[];
} {
  return {
    ...threat,
    strideCategories: JSON.parse(threat.strideCategories) as string[],
    mitigations: (threat.mitigations || []).map((m) =>
      parseMitigationJson(m as Record<string, unknown>),
    ),
  };
}

/**
 * Threat Repository
 */
export const threatRepository = {
  /**
   * List threats with pagination
   */
  async list(params: ThreatListParams): Promise<PaginatedResult<ThreatData>> {
    const prisma = await getPrisma();
    const { page, limit, skip } = normalizePagination(params);
    const {
      threatModelId,
      severity,
      status,
      search,
      since,
      sortBy = "severity",
      sortOrder = "desc",
    } = params;

    const where: Prisma.ThreatWhereInput = {
      threatModelId,
      ...(severity && { severity }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { description: { contains: search } },
        ],
      }),
      // Delta-since-sign-off filter (#61): include threats created OR
      // updated after the baseline. AND-combined with any `search` OR.
      ...(since && {
        AND: [
          { OR: [{ createdAt: { gt: since } }, { updatedAt: { gt: since } }] },
        ],
      }),
    };

    const [threats, total] = await Promise.all([
      prisma.threat.findMany({
        where,
        skip,
        take: limit,
        orderBy:
          sortBy === "severity"
            ? [{ severity: sortOrder }, { createdAt: "desc" }]
            : { [sortBy]: sortOrder },
        include: {
          mitigations: true,
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      }),
      prisma.threat.count({ where }),
    ]);

    const parsed = threats.map(parseThreat);
    return buildPaginatedResult(parsed, total, page, limit);
  },

  /**
   * Get all threats for a threat model (for canvas load).
   * Capped at 500 to prevent runaway DB scans on large models; beyond that
   * the canvas panel switches to paginated loading.
   */
  async listAll(threatModelId: string): Promise<ThreatData[]> {
    const prisma = await getPrisma();

    const threats = await prisma.threat.findMany({
      where: { threatModelId },
      take: 500,
      include: {
        mitigations: true,
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });

    return threats.map(parseThreat);
  },

  /**
   * Get threat by ID
   */
  async getById(
    id: string,
    threatModelId: string,
    includeMitigations = true,
  ): Promise<ThreatData | null> {
    const prisma = await getPrisma();

    const threat = await prisma.threat.findFirst({
      where: { id, threatModelId },
      include: {
        mitigations: includeMitigations,
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (!threat) return null;
    return parseThreat(threat);
  },

  /**
   * Create a new threat
   */
  async create(data: CreateThreatData): Promise<ThreatData> {
    const prisma = await getPrisma();

    const threat = await prisma.threat.create({
      data: {
        name: data.name,
        description: data.description,
        strideCategories: JSON.stringify(data.strideCategories),
        severity: data.severity,
        threatModelId: data.threatModelId,
        componentNodeId: data.componentNodeId,
        connectionEdgeId: data.connectionEdgeId,
        createdById: data.createdById,
      },
      include: {
        mitigations: true,
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return parseThreat(threat);
  },

  /**
   * Update a threat
   */
  async update(
    id: string,
    threatModelId: string,
    data: UpdateThreatData,
  ): Promise<ThreatData> {
    const prisma = await getPrisma();

    // Verify exists
    const existing = await prisma.threat.findFirst({
      where: { id, threatModelId },
    });

    if (!existing) {
      throw new NotFoundError("Threat", id);
    }

    const updateData: Prisma.ThreatUpdateInput = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.strideCategories)
      updateData.strideCategories = JSON.stringify(data.strideCategories);
    if (data.severity) updateData.severity = data.severity;
    if (data.status) updateData.status = data.status;
    if (data.assigneeId !== undefined) {
      updateData.assignee = data.assigneeId
        ? { connect: { id: data.assigneeId } }
        : { disconnect: true };
    }
    if (data.likelihood !== undefined) updateData.likelihood = data.likelihood;
    // Reset to AI clears the flag; any other human edit sets it
    updateData.manuallyEdited = data.manuallyEdited === false ? false : true;

    const threat = await prisma.threat.update({
      where: { id },
      data: updateData,
      include: {
        mitigations: true,
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return parseThreat(threat);
  },

  /**
   * Delete a threat
   */
  async delete(id: string, threatModelId: string): Promise<void> {
    const prisma = await getPrisma();

    const existing = await prisma.threat.findFirst({
      where: { id, threatModelId },
    });

    if (!existing) {
      throw new NotFoundError("Threat", id);
    }

    await prisma.threat.delete({ where: { id } });
  },

  /**
   * Count threats by status for a threat model
   */
  async countByStatus(threatModelId: string): Promise<{
    open: number;
    mitigated: number;
    accepted: number;
    total: number;
  }> {
    const prisma = await getPrisma();

    const counts = await prisma.threat.groupBy({
      by: ["status"],
      where: { threatModelId },
      _count: true,
    });

    const result = { open: 0, mitigated: 0, accepted: 0, total: 0 };
    for (const c of counts) {
      result.total += c._count;
      if (c.status === "OPEN") result.open = c._count;
      if (c.status === "MITIGATED") result.mitigated = c._count;
      if (c.status === "ACCEPTED") result.accepted = c._count;
    }

    return result;
  },
};
