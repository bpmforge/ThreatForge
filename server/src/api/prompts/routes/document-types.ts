/**
 * AI Prompts API - Document Type Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import {
  getDocumentTypes,
  clearCache,
} from "../../../services/ai/prompt-service.js";
import { getAuthUser, hasOrgAdminAccess, isOrgMember } from "../helpers.js";
import type { DocumentTypeInput } from "../types.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendForbidden,
  sendNoContent,
} from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

export const documentTypeRoutes: FastifyPluginAsync = async (server) => {
  /** Get all document types for an organization */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/document-types",
    routeAuthz({ org: "VIEWER" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      if (!(await isOrgMember(authUser.id, orgId))) {
        return sendNotFound(reply, "Organization");
      }

      const docTypes = await getDocumentTypes(orgId);
      return sendSuccess(reply, { documentTypes: docTypes });
    },
  );

  /** Get all built-in document types */
  server.get(
    "/api/document-types/builtin",
    routeAuthz("authenticated"),
    async (_request, reply) => {
      const prisma = await getPrisma();
      const docTypes = await prisma.documentTypeConfig.findMany({
        where: { isBuiltIn: true, isActive: true },
        include: {
          promptTemplate: { select: { id: true, name: true, category: true } },
        },
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      });
      return sendSuccess(reply, { documentTypes: docTypes });
    },
  );

  /** Create a document type configuration */
  server.post<{ Params: { orgId: string }; Body: DocumentTypeInput }>(
    "/api/organizations/:orgId/document-types",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const input = request.body;

      if (!(await hasOrgAdminAccess(authUser.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const docType = await prisma.documentTypeConfig.create({
        data: {
          name: input.name,
          description: input.description,
          icon: input.icon,
          detectionRules: input.detectionRules || "[]",
          detectionThreshold: input.detectionThreshold ?? 60,
          priority: input.priority ?? 0,
          promptTemplateId: input.promptTemplateId,
          supportedFormats:
            input.supportedFormats || '["pdf","docx","md","txt"]',
          organizationId: orgId,
          createdBy: authUser.id,
          isBuiltIn: false,
        },
        include: {
          promptTemplate: { select: { id: true, name: true, category: true } },
        },
      });

      clearCache();
      return sendCreated(reply, { documentType: docType });
    },
  );

  /** Update a document type configuration */
  server.patch<{
    Params: { orgId: string; docTypeId: string };
    Body: Partial<DocumentTypeInput>;
  }>(
    "/api/organizations/:orgId/document-types/:docTypeId",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, docTypeId } = request.params;
      const input = request.body;

      if (!(await hasOrgAdminAccess(authUser.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const existing = await prisma.documentTypeConfig.findFirst({
        where: { id: docTypeId, organizationId: orgId, isBuiltIn: false },
      });

      if (!existing) {
        return sendNotFound(reply, "Document type");
      }

      const docType = await prisma.documentTypeConfig.update({
        where: { id: docTypeId },
        data: {
          name: input.name,
          description: input.description,
          icon: input.icon,
          detectionRules: input.detectionRules,
          detectionThreshold: input.detectionThreshold,
          priority: input.priority,
          promptTemplateId: input.promptTemplateId,
          supportedFormats: input.supportedFormats,
        },
        include: {
          promptTemplate: { select: { id: true, name: true, category: true } },
        },
      });

      clearCache();
      return sendSuccess(reply, { documentType: docType });
    },
  );

  /** Delete a document type configuration */
  server.delete<{ Params: { orgId: string; docTypeId: string } }>(
    "/api/organizations/:orgId/document-types/:docTypeId",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, docTypeId } = request.params;

      if (!(await hasOrgAdminAccess(authUser.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const existing = await prisma.documentTypeConfig.findFirst({
        where: { id: docTypeId, organizationId: orgId, isBuiltIn: false },
      });

      if (!existing) {
        return sendNotFound(reply, "Document type");
      }

      await prisma.documentTypeConfig.update({
        where: { id: docTypeId },
        data: { isActive: false },
      });

      clearCache();
      return sendNoContent(reply);
    },
  );
};
