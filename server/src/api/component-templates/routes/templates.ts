/**
 * Component Templates API - Individual Template CRUD Routes
 *
 * List, create, update, delete templates within a library.
 */
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type {
  ComponentTemplate,
  ComponentTemplateLibrary,
  ComponentType,
} from "@prisma/client";
import {
  getPrisma,
  getAuthUser,
  isMemberOfOrganization,
  isOrgAdmin,
  CreateTemplateSchema,
  UpdateTemplateSchema,
  sendCreated,
  sendNoContent,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_VIEWER = routeAuthz({ org: "VIEWER" });
const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

type LibraryGate =
  | { library: ComponentTemplateLibrary; denied?: undefined }
  | { library?: undefined; denied: FastifyReply };

/** Parse the JSON-encoded columns of a template row for the API. */
export function serializeTemplate(template: ComponentTemplate) {
  return {
    ...template,
    defaultProperties: JSON.parse(template.defaultProperties),
    suggestedThreats: JSON.parse(template.suggestedThreats),
    tags: JSON.parse(template.tags),
  };
}

/** Library must belong to `orgId` and not be a default library. */
async function getModifiableLibrary(
  reply: FastifyReply,
  orgId: string,
  libraryId: string,
): Promise<LibraryGate> {
  const prisma = await getPrisma();
  const library = await prisma.componentTemplateLibrary.findUnique({
    where: { id: libraryId },
  });
  if (!library || library.organizationId !== orgId) {
    return { denied: sendNotFound(reply, "Library") };
  }

  if (library.isDefault) {
    return { denied: sendForbidden(reply, "Cannot modify default library") };
  }
  return { library };
}

export const templateRoutes: FastifyPluginAsync = async (fastify) => {
  /** GET /api/organizations/:orgId/component-templates/:libraryId/templates - List templates */
  fastify.get<{ Params: { orgId: string; libraryId: string } }>(
    "/api/organizations/:orgId/component-templates/:libraryId/templates",
    ORG_VIEWER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId } = request.params;

      if (!(await isMemberOfOrganization(user.id, orgId))) {
        return sendNotFound(reply, "Organization");
      }

      const prisma = await getPrisma();
      const library = await prisma.componentTemplateLibrary.findUnique({
        where: { id: libraryId },
      });

      if (!library) {
        return sendNotFound(reply, "Library");
      }

      // Check access
      if (
        library.organizationId !== orgId &&
        !library.isPublic &&
        !library.isDefault
      ) {
        return sendNotFound(reply, "Library");
      }

      const templates = await prisma.componentTemplate.findMany({
        where: { libraryId },
        orderBy: { name: "asc" },
      });

      return templates.map(serializeTemplate);
    },
  );

  /** POST /api/organizations/:orgId/component-templates/:libraryId/templates - Create template */
  fastify.post<{ Params: { orgId: string; libraryId: string } }>(
    "/api/organizations/:orgId/component-templates/:libraryId/templates",
    ORG_ADMIN,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId } = request.params;

      if (!(await isOrgAdmin(user.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const parsed = CreateTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const gate = await getModifiableLibrary(reply, orgId, libraryId);
      if (gate.denied) return gate.denied;

      const prisma = await getPrisma();

      const template = await prisma.componentTemplate.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          componentType: parsed.data.componentType as ComponentType,
          icon: parsed.data.icon,
          color: parsed.data.color,
          defaultProperties: JSON.stringify(
            parsed.data.defaultProperties || {},
          ),
          suggestedThreats: JSON.stringify(parsed.data.suggestedThreats || []),
          tags: JSON.stringify(parsed.data.tags || []),
          libraryId,
        },
      });

      return sendCreated(reply, serializeTemplate(template));
    },
  );

  /** PATCH /api/organizations/:orgId/component-templates/:libraryId/templates/:templateId */
  fastify.patch<{
    Params: { orgId: string; libraryId: string; templateId: string };
  }>(
    "/api/organizations/:orgId/component-templates/:libraryId/templates/:templateId",
    ORG_ADMIN,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId, templateId } = request.params;

      if (!(await isOrgAdmin(user.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const parsed = UpdateTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const gate = await getModifiableLibrary(reply, orgId, libraryId);
      if (gate.denied) return gate.denied;

      const prisma = await getPrisma();

      const updateData: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
      if (parsed.data.description !== undefined)
        updateData.description = parsed.data.description;
      if (parsed.data.componentType !== undefined)
        updateData.componentType = parsed.data.componentType;
      if (parsed.data.icon !== undefined) updateData.icon = parsed.data.icon;
      if (parsed.data.color !== undefined) updateData.color = parsed.data.color;
      if (parsed.data.defaultProperties !== undefined) {
        updateData.defaultProperties = JSON.stringify(
          parsed.data.defaultProperties,
        );
      }
      if (parsed.data.suggestedThreats !== undefined) {
        updateData.suggestedThreats = JSON.stringify(
          parsed.data.suggestedThreats,
        );
      }
      if (parsed.data.tags !== undefined) {
        updateData.tags = JSON.stringify(parsed.data.tags);
      }

      const owned = await prisma.componentTemplate.findFirst({
        where: { id: templateId, libraryId },
        select: { id: true },
      });
      if (!owned) {
        return sendNotFound(reply, "Template");
      }

      const template = await prisma.componentTemplate.update({
        where: { id: templateId },
        data: updateData as { componentType?: ComponentType },
      });

      return serializeTemplate(template);
    },
  );

  /** DELETE /api/organizations/:orgId/component-templates/:libraryId/templates/:templateId */
  fastify.delete<{
    Params: { orgId: string; libraryId: string; templateId: string };
  }>(
    "/api/organizations/:orgId/component-templates/:libraryId/templates/:templateId",
    ORG_ADMIN,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId, templateId } = request.params;

      if (!(await isOrgAdmin(user.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const gate = await getModifiableLibrary(reply, orgId, libraryId);
      if (gate.denied) return gate.denied;

      const prisma = await getPrisma();

      const { count } = await prisma.componentTemplate.deleteMany({
        where: { id: templateId, libraryId },
      });
      if (count === 0) {
        return sendNotFound(reply, "Template");
      }
      return sendNoContent(reply);
    },
  );
};
