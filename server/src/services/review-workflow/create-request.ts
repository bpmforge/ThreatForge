/**
 * Review Workflow Service - Create Review Request
 */

import { getPrisma } from "../../db.js";
import { getNotificationService } from "../notifications/index.js";
import type {
  ReviewRequest,
  ReviewerRole,
  ChecklistItem,
  WorkflowConfig,
} from "./types.js";
// A VALUE import. This was inside the `import type` block above, which made
// it usable only in type position — so the fallback below was written as
// `[] as typeof DEFAULT_CHECKLIST_TEMPLATES` and silently produced an EMPTY
// checklist for every review without an explicit workflow config. The default
// looked wired because its name appeared; it was only ever a type annotation.
import { DEFAULT_CHECKLIST_TEMPLATES } from "./types.js";
import { logReviewActivity, mapReviewRequest } from "./helpers.js";

/** Create a new review request. */
export async function createReviewRequest(params: {
  threatModelId: string;
  requestedById: string;
  reviewers: Array<{ userId: string; role: ReviewerRole; required: boolean }>;
  dueDate?: Date;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  reviewType?: "INITIAL" | "PERIODIC" | "CHANGE" | "COMPLIANCE";
  description?: string;
  scope?: string;
  workflowConfigId?: string;
}): Promise<ReviewRequest> {
  const prisma = await getPrisma();
  const notificationService = getNotificationService();

  // Get threat model info
  const threatModel = await prisma.threatModel.findUnique({
    where: { id: params.threatModelId },
    include: { project: { select: { organizationId: true } } },
  });

  if (!threatModel) {
    throw new Error("Threat model not found");
  }

  // Get requester info
  const requester = await prisma.user.findUnique({
    where: { id: params.requestedById },
    select: { name: true },
  });

  // Get workflow config or use defaults
  let workflowConfig: WorkflowConfig | null = null;
  if (params.workflowConfigId) {
    const config = await prisma.reviewWorkflowConfig.findUnique({
      where: { id: params.workflowConfigId },
    });
    if (config) {
      workflowConfig = {
        ...config,
        checklistTemplate: JSON.parse(config.checklistTemplate),
        criteria: JSON.parse(config.criteria),
        reminderDays: JSON.parse(config.reminderDays),
      } as WorkflowConfig;
    }
  }

  // Build checklist from template
  const checklist: ChecklistItem[] = [];
  const templates =
    workflowConfig?.checklistTemplate || DEFAULT_CHECKLIST_TEMPLATES;
  for (const category of templates) {
    for (const item of category.items) {
      checklist.push({
        id: `chk-${Math.random().toString(36).slice(2)}`,
        category: category.category,
        description: item.description,
        required: item.required,
        isCompleted: false,
      });
    }
  }

  // Create the review request
  const reviewRequest = await prisma.reviewRequest.create({
    data: {
      threatModelId: params.threatModelId,
      threatModelName: threatModel.name,
      version: threatModel.version,
      status: "PENDING_REVIEW",
      requestedById: params.requestedById,
      requestedByName: requester?.name || "Unknown",
      dueDate: params.dueDate,
      priority: params.priority || "NORMAL",
      reviewType: params.reviewType || "INITIAL",
      description: params.description,
      scope: params.scope,
      signOffRequired: workflowConfig?.requireSignOff ?? false,
      checklist: JSON.stringify(checklist),
      metadata: "{}",
    },
  });

  // Create reviewer assignments
  const reviewerPromises = params.reviewers.map(async (r) => {
    const user = await prisma.user.findUnique({
      where: { id: r.userId },
      select: { name: true, email: true },
    });

    return prisma.reviewAssignment.create({
      data: {
        reviewRequestId: reviewRequest.id,
        userId: r.userId,
        userName: user?.name || "Unknown",
        userEmail: user?.email || "",
        role: r.role,
        status: "PENDING",
        required: r.required,
      },
    });
  });

  await Promise.all(reviewerPromises);

  // Log activity
  await logReviewActivity(
    reviewRequest.id,
    params.requestedById,
    "REVIEW_REQUESTED",
    {
      reviewType: params.reviewType || "INITIAL",
      reviewerCount: params.reviewers.length,
    },
  );

  // Send notifications to reviewers
  for (const reviewer of params.reviewers) {
    await notificationService.notify({
      type: "MODEL_SHARED",
      category: "MODEL",
      priority: params.priority === "URGENT" ? "URGENT" : "HIGH",
      recipientIds: [reviewer.userId],
      data: {
        modelName: threatModel.name,
        sharerName: requester?.name || "Someone",
        permission: "Review",
        reviewType: params.reviewType || "INITIAL",
      },
      link: `/models/${params.threatModelId}/review/${reviewRequest.id}`,
      organizationId: threatModel.project.organizationId,
      modelId: params.threatModelId,
    });
  }

  return mapReviewRequest(reviewRequest, [], []);
}
