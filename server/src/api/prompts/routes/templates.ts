/**
 * AI Prompts API - Template CRUD Routes
 *
 * Security: systemPrompt is NEVER returned in API responses.
 * All prompts use the universal system prompt at execution time.
 * Users can only view and edit the userPromptTemplate portion.
 */
import type { FastifyPluginAsync } from "fastify";
import type { PromptCategory } from "@prisma/client";
import { getPrisma } from "../../../db.js";
import { clearCache } from "../../../services/ai/prompt-service.js";
import { getAuthUser, hasOrgAdminAccess, isOrgMember } from "../helpers.js";
import type { PromptTemplateInput } from "../types.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendForbidden,
  sendNoContent,
} from "../../../utils/api-response.js";

/** Strip systemPrompt from a prompt object before sending to client */
function sanitizePrompt<T extends Record<string, unknown>>(
  prompt: T,
): Omit<T, "systemPrompt"> {
  const { systemPrompt: _, ...safe } = prompt;
  return safe;
}

const ORG_MEMBER = routeAuthz({ org: "VIEWER" });
const ORG_ADMIN = routeAuthz({ org: "ADMIN" });
const AUTHENTICATED = routeAuthz("authenticated");

export const templateRoutes: FastifyPluginAsync = async (server) => {
  /** Get all prompt templates for an organization */
  server.get<{
    Params: { orgId: string };
    Querystring: { category?: PromptCategory };
  }>(
    "/api/organizations/:orgId/prompts",
    ORG_MEMBER,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const { category } = request.query;

      if (!(await isOrgMember(authUser.id, orgId))) {
        return sendNotFound(reply, "Organization");
      }

      const prisma = await getPrisma();
      const where: Record<string, unknown> = {
        isActive: true,
        OR: [{ organizationId: null }, { organizationId: orgId }],
      };
      if (category) where.category = category;

      const prompts = await prisma.promptTemplate.findMany({
        where,
        orderBy: [{ isBuiltIn: "desc" }, { category: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          userPromptTemplate: true,
          outputFormat: true,
          temperature: true,
          maxTokens: true,
          requiresVision: true,
          tags: true,
          variables: true,
          version: true,
          isBuiltIn: true,
          isActive: true,
          organizationId: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return sendSuccess(reply, { prompts });
    },
  );

  /** Get all built-in prompts */
  server.get("/api/prompts/builtin", AUTHENTICATED, async (_request, reply) => {
    const prisma = await getPrisma();
    const prompts = await prisma.promptTemplate.findMany({
      where: { isBuiltIn: true, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        outputFormat: true,
        temperature: true,
        maxTokens: true,
        requiresVision: true,
        tags: true,
        version: true,
      },
    });
    return sendSuccess(reply, { prompts });
  });

  /** Get a single prompt template (systemPrompt stripped) */
  server.get<{ Params: { orgId: string; promptId: string } }>(
    "/api/organizations/:orgId/prompts/:promptId",
    ORG_MEMBER,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, promptId } = request.params;

      if (!(await isOrgMember(authUser.id, orgId))) {
        return sendNotFound(reply, "Organization");
      }

      const prisma = await getPrisma();
      const prompt = await prisma.promptTemplate.findFirst({
        where: {
          id: promptId,
          OR: [{ organizationId: null }, { organizationId: orgId }],
        },
      });

      if (!prompt) return sendNotFound(reply, "Prompt");
      return sendSuccess(reply, {
        prompt: sanitizePrompt(prompt as unknown as Record<string, unknown>),
      });
    },
  );

  /** Create a new prompt template (systemPrompt ignored — universal prompt used) */
  server.post<{ Params: { orgId: string }; Body: PromptTemplateInput }>(
    "/api/organizations/:orgId/prompts",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const input = request.body;

      if (!(await hasOrgAdminAccess(authUser.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const prompt = await prisma.promptTemplate.create({
        data: {
          name: input.name,
          description: input.description,
          category: input.category,
          systemPrompt: "",
          userPromptTemplate: input.userPromptTemplate,
          variables: input.variables || "[]",
          outputFormat: input.outputFormat || "JSON",
          outputSchema: input.outputSchema,
          temperature: input.temperature ?? 0.3,
          maxTokens: input.maxTokens ?? 2000,
          requiresVision: input.requiresVision ?? false,
          tags: input.tags || "[]",
          organizationId: orgId,
          createdBy: authUser.id,
          isBuiltIn: false,
        },
      });

      clearCache();
      return sendCreated(reply, {
        prompt: sanitizePrompt(prompt as unknown as Record<string, unknown>),
      });
    },
  );

  /** Clone a prompt template (only clones userPromptTemplate, not systemPrompt) */
  server.post<{
    Params: { orgId: string; promptId: string };
    Body: { name?: string };
  }>(
    "/api/organizations/:orgId/prompts/:promptId/clone",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, promptId } = request.params;
      const { name } = request.body;

      if (!(await hasOrgAdminAccess(authUser.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const source = await prisma.promptTemplate.findFirst({
        where: {
          id: promptId,
          OR: [{ organizationId: null }, { organizationId: orgId }],
        },
      });

      if (!source) return sendNotFound(reply, "Prompt");

      const cloned = await prisma.promptTemplate.create({
        data: {
          name: name || `${source.name} (Copy)`,
          description: source.description,
          category: source.category,
          systemPrompt: "",
          userPromptTemplate: source.userPromptTemplate,
          variables: source.variables,
          outputFormat: source.outputFormat,
          outputSchema: source.outputSchema,
          temperature: source.temperature,
          maxTokens: source.maxTokens,
          requiresVision: source.requiresVision,
          tags: source.tags,
          organizationId: orgId,
          createdBy: authUser.id,
          isBuiltIn: false,
          version: 1,
        },
      });

      clearCache();
      return sendCreated(reply, {
        prompt: sanitizePrompt(cloned as unknown as Record<string, unknown>),
      });
    },
  );

  /** Update a prompt template (systemPrompt ignored — universal prompt used) */
  server.patch<{
    Params: { orgId: string; promptId: string };
    Body: Partial<PromptTemplateInput>;
  }>(
    "/api/organizations/:orgId/prompts/:promptId",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, promptId } = request.params;
      const input = request.body;

      if (!(await hasOrgAdminAccess(authUser.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const existing = await prisma.promptTemplate.findFirst({
        where: { id: promptId, organizationId: orgId, isBuiltIn: false },
      });

      if (!existing) return sendNotFound(reply, "Prompt");

      const prompt = await prisma.promptTemplate.update({
        where: { id: promptId },
        data: {
          name: input.name,
          description: input.description,
          category: input.category,
          userPromptTemplate: input.userPromptTemplate,
          variables: input.variables,
          outputFormat: input.outputFormat,
          outputSchema: input.outputSchema,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          requiresVision: input.requiresVision,
          tags: input.tags,
          version: { increment: 1 },
        },
      });

      clearCache();
      return sendSuccess(reply, {
        prompt: sanitizePrompt(prompt as unknown as Record<string, unknown>),
      });
    },
  );

  /** Delete a prompt template */
  server.delete<{ Params: { orgId: string; promptId: string } }>(
    "/api/organizations/:orgId/prompts/:promptId",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, promptId } = request.params;

      if (!(await hasOrgAdminAccess(authUser.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const existing = await prisma.promptTemplate.findFirst({
        where: { id: promptId, organizationId: orgId, isBuiltIn: false },
      });

      if (!existing)
        return reply
          .status(404)
          .send({ error: "Prompt not found or is built-in" });

      await prisma.promptTemplate.update({
        where: { id: promptId },
        data: { isActive: false },
      });

      clearCache();
      return sendNoContent(reply);
    },
  );
};
