/**
 * Mitigation Repository
 *
 * Data access layer for mitigations with pagination support.
 */

import type { MitigationStatus, Priority, Prisma } from "@prisma/client";
import {
  getPrisma,
  type PaginationParams,
  type PaginatedResult,
  normalizePagination,
  buildPaginatedResult,
  NotFoundError,
} from "./base.js";

export interface MitigationListParams extends PaginationParams {
  threatId: string;
  status?: MitigationStatus;
  priority?: Priority;
  sortBy?: "priority" | "createdAt" | "status";
  sortOrder?: "asc" | "desc";
}

export interface MitigationData {
  id: string;
  description: string;
  status: string;
  priority: string;
  notes: string | null;
  dueDate: Date | null;
  threatId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  // Traceability + testability (parsed from JSON strings)
  controlCategory?: string | null;
  testCriteria?: string | null;
  testResult?: string | null;
  effectivenessScore?: number | null;
  implementationNotes?: string | null;
  evidenceLinks: Array<{ type: string; url: string; title: string }>;
  requirementRefs: Array<{ docId: string; reqId: string; text: string }>;
  // Normalized requirement links
  requirements: Array<{
    id: string;
    reqId: string;
    text: string;
    category: string | null;
    docId: string | null;
  }>;
}

/** Parse JSON string fields on a raw Prisma mitigation row */
function parseMitigation(raw: Record<string, unknown>): MitigationData {
  // Extract normalized requirements from junction table if present
  const requirements = Array.isArray(raw.requirements)
    ? (raw.requirements as Array<{ requirement: Record<string, unknown> }>).map(
        (jr) => jr.requirement as MitigationData["requirements"][number],
      )
    : [];

  return {
    ...(raw as unknown as MitigationData),
    evidenceLinks: (() => {
      try {
        return JSON.parse((raw.evidenceLinks as string) || "[]");
      } catch {
        return [];
      }
    })(),
    requirementRefs: (() => {
      try {
        return JSON.parse((raw.requirementRefs as string) || "[]");
      } catch {
        return [];
      }
    })(),
    requirements,
  };
}

/** Include shape for requirement junction joins */
const requirementsInclude = {
  requirements: {
    select: {
      requirement: {
        select: {
          id: true,
          reqId: true,
          text: true,
          category: true,
          docId: true,
        },
      },
    },
  },
} as const;

export interface CreateMitigationData {
  description: string;
  status?: MitigationStatus;
  priority?: Priority;
  notes?: string;
  dueDate?: Date;
  threatId: string;
  createdById: string;
}

export interface UpdateMitigationData {
  description?: string;
  status?: MitigationStatus;
  priority?: Priority;
  notes?: string | null;
  dueDate?: Date | null;
  controlCategory?: string | null;
  testCriteria?: string | null;
  testResult?: string | null;
  effectivenessScore?: number | null;
  implementationNotes?: string | null;
  evidenceLinks?: Array<{ type: string; url: string; title: string }> | null;
  requirementRefs?: Array<{
    docId: string;
    reqId: string;
    text: string;
  }> | null;
  /** Replaces all junction-table requirement links when provided */
  requirementIds?: string[] | null;
}

/**
 * Mitigation Repository
 */
export const mitigationRepository = {
  /**
   * List mitigations with pagination
   */
  async list(
    params: MitigationListParams,
  ): Promise<PaginatedResult<MitigationData>> {
    const prisma = await getPrisma();
    const { page, limit, skip } = normalizePagination(params);
    const {
      threatId,
      status,
      priority,
      sortBy = "priority",
      sortOrder = "desc",
    } = params;

    const where: Prisma.MitigationWhereInput = {
      threatId,
      ...(status && { status }),
      ...(priority && { priority }),
    };

    const [mitigations, total] = await Promise.all([
      prisma.mitigation.findMany({
        where,
        skip,
        take: limit,
        include: requirementsInclude,
        orderBy:
          sortBy === "priority"
            ? [{ priority: sortOrder }, { createdAt: "desc" }]
            : { [sortBy]: sortOrder },
      }),
      prisma.mitigation.count({ where }),
    ]);

    return buildPaginatedResult(
      mitigations.map((m) => parseMitigation(m as Record<string, unknown>)),
      total,
      page,
      limit,
    );
  },

  /**
   * Get all mitigations for a threat (unpaginated)
   */
  async listAll(threatId: string): Promise<MitigationData[]> {
    const prisma = await getPrisma();
    const rows = await prisma.mitigation.findMany({
      where: { threatId },
      include: requirementsInclude,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return rows.map((m) => parseMitigation(m as Record<string, unknown>));
  },

  /**
   * Get mitigation by ID
   */
  async getById(id: string, threatId: string): Promise<MitigationData | null> {
    const prisma = await getPrisma();
    const row = await prisma.mitigation.findFirst({
      where: { id, threatId },
      include: requirementsInclude,
    });
    return row ? parseMitigation(row as Record<string, unknown>) : null;
  },

  /**
   * Create a new mitigation
   */
  async create(data: CreateMitigationData): Promise<MitigationData> {
    const prisma = await getPrisma();
    const row = await prisma.mitigation.create({
      data: {
        description: data.description,
        status: data.status || "NOT_IMPLEMENTED",
        priority: data.priority || "MEDIUM",
        notes: data.notes,
        dueDate: data.dueDate,
        threatId: data.threatId,
        createdById: data.createdById,
      },
    });
    return parseMitigation(row as Record<string, unknown>);
  },

  /**
   * Update a mitigation
   */
  async update(
    id: string,
    threatId: string,
    data: UpdateMitigationData,
  ): Promise<MitigationData> {
    const prisma = await getPrisma();

    // Verify exists
    const existing = await prisma.mitigation.findFirst({
      where: { id, threatId },
    });

    if (!existing) {
      throw new NotFoundError("Mitigation", id);
    }

    const updateData: Prisma.MitigationUpdateInput = {};
    if (data.description) updateData.description = data.description;
    if (data.status) updateData.status = data.status;
    if (data.priority) updateData.priority = data.priority;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.controlCategory !== undefined)
      updateData.controlCategory = data.controlCategory;
    if (data.testCriteria !== undefined)
      updateData.testCriteria = data.testCriteria;
    if (data.testResult !== undefined) updateData.testResult = data.testResult;
    if (data.effectivenessScore !== undefined)
      updateData.effectivenessScore = data.effectivenessScore;
    if (data.implementationNotes !== undefined)
      updateData.implementationNotes = data.implementationNotes;
    if (data.evidenceLinks !== undefined) {
      updateData.evidenceLinks = data.evidenceLinks
        ? JSON.stringify(data.evidenceLinks)
        : "[]";
    }
    if (data.requirementRefs !== undefined) {
      updateData.requirementRefs = data.requirementRefs
        ? JSON.stringify(data.requirementRefs)
        : "[]";
    }

    if (data.requirementIds !== undefined) {
      // Use a transaction: replace all junction rows then return the updated record
      const result = await prisma.$transaction(async (tx) => {
        await tx.mitigation.update({ where: { id }, data: updateData });

        // Replace junction table entries
        await tx.mitigationRequirement.deleteMany({
          where: { mitigationId: id },
        });
        if (data.requirementIds && data.requirementIds.length > 0) {
          await tx.mitigationRequirement.createMany({
            data: data.requirementIds.map((requirementId) => ({
              mitigationId: id,
              requirementId,
            })),
          });
        }

        return tx.mitigation.findFirst({
          where: { id },
          include: requirementsInclude,
        });
      });

      return parseMitigation(result as Record<string, unknown>);
    }

    const row = await prisma.mitigation.update({
      where: { id },
      data: updateData,
      include: requirementsInclude,
    });
    return parseMitigation(row as Record<string, unknown>);
  },

  /**
   * Delete a mitigation
   */
  async delete(id: string, threatId: string): Promise<void> {
    const prisma = await getPrisma();

    const existing = await prisma.mitigation.findFirst({
      where: { id, threatId },
    });

    if (!existing) {
      throw new NotFoundError("Mitigation", id);
    }

    await prisma.mitigation.delete({ where: { id } });
  },

  /**
   * Count mitigations by status for a threat
   */
  async countByStatus(threatId: string): Promise<{
    notImplemented: number;
    implemented: number;
  }> {
    const prisma = await getPrisma();

    const counts = await prisma.mitigation.groupBy({
      by: ["status"],
      where: { threatId },
      _count: true,
    });

    const result = { notImplemented: 0, implemented: 0 };
    for (const c of counts) {
      if (c.status === "NOT_IMPLEMENTED") result.notImplemented = c._count;
      if (c.status === "IMPLEMENTED") result.implemented = c._count;
    }

    return result;
  },
};
