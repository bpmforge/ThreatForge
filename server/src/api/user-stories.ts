/**
 * User Story API routes.
 *
 * CRUD operations for user stories and linking to DFD data flows.
 * All routes require authentication.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendNotFound,
  sendBadRequest,
} from "../utils/api-response.js";
import type { UserStoryStatus } from "@prisma/client";
import { authorizeProject } from "./projects/helpers.js";
import { routeAuthz } from "../middleware/authz-policy.js";

const PROJECT_VIEW = routeAuthz({
  handler: "org role with view on the project",
});
const PROJECT_EDIT = routeAuthz({
  handler: "org role with edit on the project",
});

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateUserStorySchema = z.object({
  title: z.string().min(1).max(255),
  asA: z.string().min(1).max(255),
  iWant: z.string().min(1),
  soThat: z.string().min(1),
  acceptanceCriteria: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "READY", "IN_PROGRESS", "DONE"]).optional(),
  tags: z.array(z.string()).optional(),
  externalId: z.string().optional(),
});

const UpdateUserStorySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  asA: z.string().min(1).max(255).optional(),
  iWant: z.string().min(1).optional(),
  soThat: z.string().min(1).optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "READY", "IN_PROGRESS", "DONE"]).optional(),
  tags: z.array(z.string()).optional(),
  externalId: z.string().optional().nullable(),
});

const LinkDataFlowSchema = z.object({
  dataFlowId: z.string(),
});

export async function userStoryRoutes(fastify: FastifyInstance) {
  // =============================================================================
  // User Story CRUD
  // =============================================================================

  /** GET /api/projects/:projectId/user-stories - List user stories */
  fastify.get<{
    Params: { projectId: string };
    Querystring: {
      page?: string;
      limit?: string;
      status?: string;
      search?: string;
    };
  }>(
    "/api/projects/:projectId/user-stories",
    PROJECT_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId } = request.params;
      const { page: pageStr, limit: limitStr, status, search } = request.query;

      if (!(await authorizeProject(reply, user.id, projectId, "view"))) {
        return reply;
      }

      const page = Math.max(1, parseInt(pageStr || "1", 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(limitStr || "20", 10) || 20),
      );
      const skip = (page - 1) * limit;

      const prisma = await getPrisma();

      const where: {
        projectId: string;
        status?: UserStoryStatus;
        OR?: Array<{
          title?: { contains: string };
          asA?: { contains: string };
          iWant?: { contains: string };
        }>;
      } = { projectId };

      if (status) {
        where.status = status as UserStoryStatus;
      }

      if (search) {
        where.OR = [
          { title: { contains: search } },
          { asA: { contains: search } },
          { iWant: { contains: search } },
        ];
      }

      const [stories, total] = await Promise.all([
        prisma.userStory.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            dataFlows: {
              include: {
                dataFlow: {
                  select: { id: true, name: true, number: true },
                },
              },
            },
          },
        }),
        prisma.userStory.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return sendSuccess(reply, {
        data: stories.map((story) => ({
          ...story,
          acceptanceCriteria: JSON.parse(story.acceptanceCriteria),
          tags: JSON.parse(story.tags),
          dataFlows: story.dataFlows.map((df) => df.dataFlow),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    },
  );

  /** GET /api/projects/:projectId/user-stories/:storyId - Get single user story */
  fastify.get<{ Params: { projectId: string; storyId: string } }>(
    "/api/projects/:projectId/user-stories/:storyId",
    PROJECT_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId, storyId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "view"))) {
        return reply;
      }

      const prisma = await getPrisma();
      const story = await prisma.userStory.findUnique({
        where: { id: storyId },
        include: {
          dataFlows: {
            include: {
              dataFlow: {
                include: {
                  sourceProcess: true,
                  targetProcess: true,
                  sourceDataStore: true,
                  targetDataStore: true,
                  sourceEntity: true,
                  targetEntity: true,
                },
              },
            },
          },
        },
      });

      if (!story || story.projectId !== projectId) {
        return sendNotFound(reply, "User story");
      }

      return sendSuccess(reply, {
        ...story,
        acceptanceCriteria: JSON.parse(story.acceptanceCriteria),
        tags: JSON.parse(story.tags),
        dataFlows: story.dataFlows.map((df) => df.dataFlow),
      });
    },
  );

  /** POST /api/projects/:projectId/user-stories - Create user story */
  fastify.post<{ Params: { projectId: string } }>(
    "/api/projects/:projectId/user-stories",
    PROJECT_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "edit"))) {
        return reply;
      }

      const parsed = CreateUserStorySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parsed.error.flatten(),
        });
      }

      const prisma = await getPrisma();
      const story = await prisma.userStory.create({
        data: {
          title: parsed.data.title,
          asA: parsed.data.asA,
          iWant: parsed.data.iWant,
          soThat: parsed.data.soThat,
          acceptanceCriteria: JSON.stringify(
            parsed.data.acceptanceCriteria || [],
          ),
          status: (parsed.data.status as UserStoryStatus) || "DRAFT",
          tags: JSON.stringify(parsed.data.tags || []),
          externalId: parsed.data.externalId,
          projectId,
        },
      });

      return sendCreated(reply, {
        ...story,
        acceptanceCriteria: JSON.parse(story.acceptanceCriteria),
        tags: JSON.parse(story.tags),
      });
    },
  );

  /** PATCH /api/projects/:projectId/user-stories/:storyId - Update user story */
  fastify.patch<{ Params: { projectId: string; storyId: string } }>(
    "/api/projects/:projectId/user-stories/:storyId",
    PROJECT_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId, storyId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "edit"))) {
        return reply;
      }

      const parsed = UpdateUserStorySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parsed.error.flatten(),
        });
      }

      const prisma = await getPrisma();
      const existing = await prisma.userStory.findUnique({
        where: { id: storyId },
      });
      if (!existing || existing.projectId !== projectId) {
        return sendNotFound(reply, "User story");
      }

      const updateData: Record<string, unknown> = {};
      if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
      if (parsed.data.asA !== undefined) updateData.asA = parsed.data.asA;
      if (parsed.data.iWant !== undefined) updateData.iWant = parsed.data.iWant;
      if (parsed.data.soThat !== undefined)
        updateData.soThat = parsed.data.soThat;
      if (parsed.data.acceptanceCriteria !== undefined) {
        updateData.acceptanceCriteria = JSON.stringify(
          parsed.data.acceptanceCriteria,
        );
      }
      if (parsed.data.status !== undefined)
        updateData.status = parsed.data.status;
      if (parsed.data.tags !== undefined)
        updateData.tags = JSON.stringify(parsed.data.tags);
      if (parsed.data.externalId !== undefined)
        updateData.externalId = parsed.data.externalId;

      const story = await prisma.userStory.update({
        where: { id: storyId },
        data: updateData as { status?: UserStoryStatus },
      });

      return sendSuccess(reply, {
        ...story,
        acceptanceCriteria: JSON.parse(story.acceptanceCriteria),
        tags: JSON.parse(story.tags),
      });
    },
  );

  /** DELETE /api/projects/:projectId/user-stories/:storyId - Delete user story */
  fastify.delete<{ Params: { projectId: string; storyId: string } }>(
    "/api/projects/:projectId/user-stories/:storyId",
    PROJECT_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId, storyId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "edit"))) {
        return reply;
      }

      const prisma = await getPrisma();
      const existing = await prisma.userStory.findUnique({
        where: { id: storyId },
      });
      if (!existing || existing.projectId !== projectId) {
        return sendNotFound(reply, "User story");
      }

      await prisma.userStory.delete({ where: { id: storyId } });
      return sendNoContent(reply);
    },
  );

  // =============================================================================
  // Data Flow Linking
  // =============================================================================

  /** POST /api/projects/:projectId/user-stories/:storyId/data-flows - Link data flow */
  fastify.post<{ Params: { projectId: string; storyId: string } }>(
    "/api/projects/:projectId/user-stories/:storyId/data-flows",
    PROJECT_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId, storyId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "edit"))) {
        return reply;
      }

      const parsed = LinkDataFlowSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parsed.error.flatten(),
        });
      }

      const prisma = await getPrisma();

      // Verify story exists
      const story = await prisma.userStory.findUnique({
        where: { id: storyId },
      });
      if (!story || story.projectId !== projectId) {
        return sendNotFound(reply, "User story");
      }

      // The data flow must belong to a model of this project
      const dataFlow = await prisma.dFDDataFlow.findFirst({
        where: {
          id: parsed.data.dataFlowId,
          dfd: { threatModel: { projectId } },
        },
        select: { id: true },
      });
      if (!dataFlow) {
        return sendNotFound(reply, "Data flow");
      }

      // Create link
      const link = await prisma.userStoryDataFlow.create({
        data: {
          userStoryId: storyId,
          dataFlowId: parsed.data.dataFlowId,
        },
        include: {
          dataFlow: true,
        },
      });

      return sendCreated(reply, link);
    },
  );

  /** DELETE /api/projects/:projectId/user-stories/:storyId/data-flows/:dataFlowId - Unlink data flow */
  fastify.delete<{
    Params: { projectId: string; storyId: string; dataFlowId: string };
  }>(
    "/api/projects/:projectId/user-stories/:storyId/data-flows/:dataFlowId",
    PROJECT_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId, storyId, dataFlowId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "edit"))) {
        return reply;
      }

      const prisma = await getPrisma();

      const story = await prisma.userStory.findFirst({
        where: { id: storyId, projectId },
        select: { id: true },
      });
      if (!story) {
        return sendNotFound(reply, "User story");
      }

      // Find and delete the link
      const link = await prisma.userStoryDataFlow.findUnique({
        where: {
          userStoryId_dataFlowId: {
            userStoryId: storyId,
            dataFlowId,
          },
        },
      });

      if (!link) {
        return sendNotFound(reply, "Link");
      }

      await prisma.userStoryDataFlow.delete({
        where: { id: link.id },
      });

      return sendNoContent(reply);
    },
  );
}
