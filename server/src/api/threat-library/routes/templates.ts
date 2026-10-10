/**
 * Threat Library API - Template CRUD Routes
 *
 * Org-scoped and convenience (auto-detect org) template operations.
 */
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type {
  ThreatLibrary,
  ThreatTemplate,
  StrideCategory,
  Severity,
} from "@prisma/client";
import type { z } from "zod";
import { getPrisma } from "../../../db.js";
import {
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendNoContent,
} from "../../../utils/api-response.js";
import { getAuthUser, isOrgAdmin } from "../helpers.js";
import { CreateTemplateSchema, UpdateTemplateSchema } from "../schemas.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

type LibraryGate =
  | { library: ThreatLibrary; denied?: undefined }
  | { library?: undefined; denied: FastifyReply };

/** Parse the JSON-encoded list/map columns of a template row for the API. */
export function serializeThreatTemplate(template: ThreatTemplate) {
  return {
    ...template,
    applicableComponentTypes: JSON.parse(template.applicableComponentTypes),
    suggestedMitigations: JSON.parse(template.suggestedMitigations),
    complianceControls: JSON.parse(template.complianceControls),
    cweIds: JSON.parse(template.cweIds),
    owaspIds: JSON.parse(template.owaspIds),
  };
}

/** Org-scoped: library must belong to `orgId` and not be a default library. */
async function getOrgModifiableLibrary(
  reply: FastifyReply,
  orgId: string,
  libraryId: string,
): Promise<LibraryGate> {
  const prisma = await getPrisma();
  const library = await prisma.threatLibrary.findUnique({
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

/** Convenience: caller must be admin of the library's own org; default libraries refused. */
async function getOwnModifiableLibrary(
  reply: FastifyReply,
  userId: string,
  libraryId: string,
): Promise<LibraryGate> {
  const prisma = await getPrisma();
  const library = await prisma.threatLibrary.findUnique({
    where: { id: libraryId },
  });
  if (!library || !library.organizationId) {
    return { denied: sendNotFound(reply, "Library") };
  }

  if (!(await isOrgAdmin(userId, library.organizationId))) {
    return { denied: sendForbidden(reply, "Admin access required") };
  }

  if (library.isDefault) {
    return { denied: sendForbidden(reply, "Cannot modify default library") };
  }
  return { library };
}

async function createTemplate(
  reply: FastifyReply,
  libraryId: string,
  data: z.infer<typeof CreateTemplateSchema>,
) {
  const prisma = await getPrisma();
  const template = await prisma.threatTemplate.create({
    data: {
      name: data.name,
      description: data.description,
      strideCategory: data.strideCategory as StrideCategory,
      defaultSeverity: (data.defaultSeverity as Severity) || "MEDIUM",
      applicableComponentTypes: JSON.stringify(
        data.applicableComponentTypes || [],
      ),
      suggestedMitigations: JSON.stringify(data.suggestedMitigations || []),
      complianceControls: JSON.stringify(data.complianceControls || {}),
      cweIds: JSON.stringify(data.cweIds || []),
      owaspIds: JSON.stringify(data.owaspIds || []),
      libraryId,
    },
  });

  return sendCreated(reply, serializeThreatTemplate(template));
}

async function updateTemplate(
  reply: FastifyReply,
  libraryId: string,
  templateId: string,
  data: z.infer<typeof UpdateTemplateSchema>,
) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.strideCategory !== undefined)
    updateData.strideCategory = data.strideCategory;
  if (data.defaultSeverity !== undefined)
    updateData.defaultSeverity = data.defaultSeverity;
  if (data.applicableComponentTypes !== undefined) {
    updateData.applicableComponentTypes = JSON.stringify(
      data.applicableComponentTypes,
    );
  }
  if (data.suggestedMitigations !== undefined) {
    updateData.suggestedMitigations = JSON.stringify(data.suggestedMitigations);
  }
  if (data.complianceControls !== undefined) {
    updateData.complianceControls = JSON.stringify(data.complianceControls);
  }
  if (data.cweIds !== undefined) {
    updateData.cweIds = JSON.stringify(data.cweIds);
  }
  if (data.owaspIds !== undefined) {
    updateData.owaspIds = JSON.stringify(data.owaspIds);
  }

  const prisma = await getPrisma();
  const owned = await prisma.threatTemplate.findFirst({
    where: { id: templateId, libraryId },
    select: { id: true },
  });
  if (!owned) {
    return sendNotFound(reply, "Template");
  }

  const template = await prisma.threatTemplate.update({
    where: { id: templateId },
    data: updateData as {
      strideCategory?: StrideCategory;
      defaultSeverity?: Severity;
    },
  });

  return serializeThreatTemplate(template);
}

async function deleteTemplate(
  reply: FastifyReply,
  libraryId: string,
  templateId: string,
) {
  const prisma = await getPrisma();
  const { count } = await prisma.threatTemplate.deleteMany({
    where: { id: templateId, libraryId },
  });
  if (count === 0) {
    return sendNotFound(reply, "Template");
  }
  return sendNoContent(reply);
}

export const templateRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // Org-scoped routes
  // ===========================================================================

  /** POST /api/organizations/:orgId/threat-libraries/:libraryId/templates - Create template */
  fastify.post<{ Params: { orgId: string; libraryId: string } }>(
    "/api/organizations/:orgId/threat-libraries/:libraryId/templates",
    routeAuthz({ org: "ADMIN" }),
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

      const gate = await getOrgModifiableLibrary(reply, orgId, libraryId);
      if (gate.denied) return gate.denied;

      return createTemplate(reply, libraryId, parsed.data);
    },
  );

  /** PATCH /api/organizations/:orgId/threat-libraries/:libraryId/templates/:templateId */
  fastify.patch<{
    Params: { orgId: string; libraryId: string; templateId: string };
  }>(
    "/api/organizations/:orgId/threat-libraries/:libraryId/templates/:templateId",
    routeAuthz({ org: "ADMIN" }),
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

      const gate = await getOrgModifiableLibrary(reply, orgId, libraryId);
      if (gate.denied) return gate.denied;

      return updateTemplate(reply, libraryId, templateId, parsed.data);
    },
  );

  /** DELETE /api/organizations/:orgId/threat-libraries/:libraryId/templates/:templateId */
  fastify.delete<{
    Params: { orgId: string; libraryId: string; templateId: string };
  }>(
    "/api/organizations/:orgId/threat-libraries/:libraryId/templates/:templateId",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId, templateId } = request.params;

      if (!(await isOrgAdmin(user.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const gate = await getOrgModifiableLibrary(reply, orgId, libraryId);
      if (gate.denied) return gate.denied;

      return deleteTemplate(reply, libraryId, templateId);
    },
  );

  // ===========================================================================
  // Convenience routes (auto-detect user's organization)
  // ===========================================================================

  /** POST /api/threat-libraries/:libraryId/templates - Create template */
  fastify.post<{ Params: { libraryId: string } }>(
    "/api/threat-libraries/:libraryId/templates",
    routeAuthz({
      handler:
        "ACTIVE OWNER/ADMIN of the org that owns :libraryId (library looked up; org-less/default libraries refused)",
    }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { libraryId } = request.params;

      const parsed = CreateTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const gate = await getOwnModifiableLibrary(reply, user.id, libraryId);
      if (gate.denied) return gate.denied;

      return createTemplate(reply, libraryId, parsed.data);
    },
  );

  /** PATCH /api/threat-libraries/:libraryId/templates/:templateId - Update template */
  fastify.patch<{ Params: { libraryId: string; templateId: string } }>(
    "/api/threat-libraries/:libraryId/templates/:templateId",
    routeAuthz({
      handler:
        "ACTIVE OWNER/ADMIN of the org that owns :libraryId (library looked up; org-less/default libraries refused)",
    }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { libraryId, templateId } = request.params;

      const parsed = UpdateTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const gate = await getOwnModifiableLibrary(reply, user.id, libraryId);
      if (gate.denied) return gate.denied;

      return updateTemplate(reply, libraryId, templateId, parsed.data);
    },
  );

  /** DELETE /api/threat-libraries/:libraryId/templates/:templateId - Delete template */
  fastify.delete<{ Params: { libraryId: string; templateId: string } }>(
    "/api/threat-libraries/:libraryId/templates/:templateId",
    routeAuthz({
      handler:
        "ACTIVE OWNER/ADMIN of the org that owns :libraryId (library looked up; org-less/default libraries refused)",
    }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { libraryId, templateId } = request.params;

      const gate = await getOwnModifiableLibrary(reply, user.id, libraryId);
      if (gate.denied) return gate.denied;

      return deleteTemplate(reply, libraryId, templateId);
    },
  );
};
