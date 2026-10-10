/**
 * Model Freshness Check Service
 *
 * Identifies threat models that haven't been updated recently
 * and generates notification/reminder data.
 *
 * Can be called:
 * - On cron schedule (daily)
 * - On login (check user's models)
 * - Via API (admin dashboard)
 */
import { getPrisma } from "../../db.js";

export interface StaleModel {
  id: string;
  name: string;
  projectName: string;
  organizationId: string;
  updatedAt: Date;
  daysSinceUpdate: number;
  threatCount: number;
  openThreatCount: number;
  staleness: "warning" | "critical";
}

/**
 * Find all threat models that haven't been updated within the threshold.
 */
export async function findStaleModels(options?: {
  warningDays?: number;
  criticalDays?: number;
  organizationId?: string;
}): Promise<StaleModel[]> {
  const warningDays = options?.warningDays ?? 30;
  const criticalDays = options?.criticalDays ?? 90;
  const warningDate = new Date(Date.now() - warningDays * 24 * 60 * 60 * 1000);

  const prisma = await getPrisma();

  const models = await prisma.threatModel.findMany({
    where: {
      updatedAt: { lt: warningDate },
      ...(options?.organizationId && {
        project: { organizationId: options.organizationId },
      }),
    },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      project: {
        select: {
          name: true,
          organizationId: true,
        },
      },
      _count: {
        select: { threats: true },
      },
      threats: {
        where: { status: "OPEN" },
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "asc" },
  });

  const now = Date.now();

  return models.map((model) => {
    const daysSinceUpdate = Math.floor(
      (now - model.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      id: model.id,
      name: model.name,
      projectName: model.project.name,
      organizationId: model.project.organizationId,
      updatedAt: model.updatedAt,
      daysSinceUpdate,
      threatCount: model._count.threats,
      openThreatCount: model.threats.length,
      staleness: daysSinceUpdate >= criticalDays ? "critical" : "warning",
    };
  });
}
