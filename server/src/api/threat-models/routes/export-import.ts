/**
 * Threat Model API - Export/Import Routes
 *
 * Endpoints for importing from external tools and exporting in various formats:
 * - POST /api/threat-models/import/terraform — Parse .tf files
 * - POST /api/threat-models/import/tool — Import from MS TMT, OWASP Dragon, Threagile
 * - POST /api/threat-models/import/yaml — Import ThreatForge YAML format
 * - GET /api/threat-models/:id/export/yaml — Export as YAML
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { getPrisma } from "../../../db.js";
import {
  getAuthUser,
  authorizeModelExport,
  resolveModelTargetProject,
} from "../helpers.js";
import type { Severity, ThreatStatus, Prisma } from "@prisma/client";
import {
  sendCreated,
  sendBadRequest,
  sendNotFound,
} from "../../../utils/api-response.js";
import { logAudit } from "../../../services/audit.js";
import logger from "../../../utils/logger.js";
import { parseTerraform } from "../../../services/iac-parser/terraform-parser.js";
import { parseKubernetes } from "../../../services/iac-parser/kubernetes-parser.js";
import { parseDockerCompose } from "../../../services/iac-parser/docker-compose-parser.js";
import { importThreatModel } from "../../../services/import/tool-importer.js";
import {
  exportToYAML,
  parseYAMLThreatModel,
  normalizeRichLabel,
} from "../../../services/export/yaml-export.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const PROJECT_ORG_EDITOR = routeAuthz({
  handler: "EDITOR+ in the target project's organization",
});
const MODEL_VIEW = routeAuthz({ model: "view" });

/** Largest IaC file accepted for import. */
const MAX_IAC_CONTENT_BYTES = 1024 * 1024;

interface IacImportBody {
  content: string;
  name?: string;
  projectId?: string;
}

interface IacImportComponent {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number };
}

interface IacImportResult<C extends IacImportComponent> {
  components: C[];
  connections: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    protocol?: string;
    encrypted?: boolean;
  }>;
  warnings: string[];
  resourceCount: number;
}

/**
 * Shared body of the IaC import routes (Terraform, Kubernetes, Docker
 * Compose): validate content, parse, resolve the target project, create a
 * threat model with a canvas built from the parsed components, audit, and
 * respond 201.
 */
async function handleIacImport<C extends IacImportComponent>(
  request: FastifyRequest<{ Body: IacImportBody }>,
  reply: FastifyReply,
  opts: {
    missingContentError: string;
    parse: (content: string) => IacImportResult<C>;
    noResourcesError: string;
    describe: (component: C) => string;
    defaultName: string;
    auditType: string;
  },
) {
  const user = getAuthUser(request);
  const prisma = await getPrisma();
  const { content, name, projectId } = request.body;

  if (!content?.trim()) {
    return sendBadRequest(reply, opts.missingContentError);
  }
  if (Buffer.byteLength(content) > MAX_IAC_CONTENT_BYTES) {
    return sendBadRequest(reply, "Content exceeds the 1 MiB import limit");
  }

  const result = opts.parse(content);

  if (result.components.length === 0) {
    return sendBadRequest(reply, opts.noResourcesError);
  }

  const targetProjectId = await resolveModelTargetProject(
    reply,
    user.id,
    projectId,
  );
  if (!targetProjectId) return reply;

  const nodes = result.components.map((c) => ({
    id: c.id,
    type: "component",
    position: c.position,
    data: {
      label: c.name,
      type: c.type,
      trustLevel: "INTERNAL",
      description: opts.describe(c),
    },
  }));

  const edges = result.connections.map((c) => ({
    id: c.id,
    source: c.source,
    target: c.target,
    label: c.label,
    data: {
      protocol: c.protocol,
      encrypted: c.encrypted,
    },
  }));

  const model = await prisma.threatModel.create({
    data: {
      name: name || opts.defaultName,
      projectId: targetProjectId,
      createdById: user.id,
      canvasState: JSON.stringify({ nodes, edges }),
    },
  });

  logAudit({
    action: "CREATE",
    resourceType: "THREAT_MODEL",
    resourceId: model.id,
    resourceName: model.name,
    userId: user.id,
    userEmail: user.email || "unknown",
    organizationId: "",
    metadata: {
      type: opts.auditType,
      resourceCount: result.resourceCount,
    },
  }).catch((err) => logger.warn({ err }, "Audit log failed"));

  return sendCreated(reply, {
    modelId: model.id,
    modelName: model.name,
    componentCount: result.components.length,
    connectionCount: result.connections.length,
    resourceCount: result.resourceCount,
    warnings: result.warnings,
  });
}

export const exportImportRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/threat-models/import/terraform
   * Parse Terraform files and create a threat model from the infrastructure.
   */
  fastify.post<{
    Body: { content: string; name?: string; projectId?: string };
  }>(
    "/api/threat-models/import/terraform",
    PROJECT_ORG_EDITOR,
    async (request, reply) => {
      return handleIacImport(request, reply, {
        missingContentError: "Terraform content is required",
        parse: parseTerraform,
        noResourcesError: "No recognizable resources found in Terraform file",
        describe: (c) => `Terraform: ${c.terraformType}`,
        defaultName: "Terraform Import",
        auditType: "terraform_import",
      });
    },
  );

  /**
   * POST /api/threat-models/import/tool
   * Import from external threat modeling tools (MS TMT, OWASP Dragon, Threagile).
   */
  fastify.post<{
    Body: {
      content: string;
      filename?: string;
      name?: string;
      projectId?: string;
    };
  }>(
    "/api/threat-models/import/tool",
    PROJECT_ORG_EDITOR,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { content, filename, name, projectId } = request.body;

      if (!content?.trim()) {
        return sendBadRequest(reply, "File content is required");
      }

      const imported = importThreatModel(content, filename);

      if (imported.components.length === 0 && imported.threats.length === 0) {
        return sendBadRequest(
          reply,
          `Could not parse file. Detected format: ${imported.source}. ${imported.warnings.join(". ")}`,
        );
      }

      const targetProjectId = await resolveModelTargetProject(
        reply,
        user.id,
        projectId,
      );
      if (!targetProjectId) return reply;

      const nodes = imported.components.map((c) => ({
        id: c.id,
        type: "component",
        position: c.position,
        data: {
          label: c.name,
          type: c.type,
          trustLevel: "INTERNAL",
          ...c.properties,
        },
      }));

      const edges = imported.connections.map((c) => ({
        id: c.id,
        source: c.source,
        target: c.target,
        label: c.label,
        data: c.properties,
      }));

      const model = await prisma.threatModel.create({
        data: {
          name: name || imported.name || "Imported Model",
          projectId: targetProjectId,
          createdById: user.id,
          canvasState: JSON.stringify({ nodes, edges }),
        },
      });

      // Create threats if the imported model had them
      if (imported.threats.length > 0) {
        await prisma.threat.createMany({
          data: imported.threats.map((t) => ({
            threatModelId: model.id,
            name: t.name,
            description: t.description || null,
            strideCategories: JSON.stringify([t.strideCategory]),
            severity: (t.severity || "MEDIUM") as Severity,
            status: (t.status || "OPEN") as ThreatStatus,
            componentNodeId: t.componentId || null,
            createdById: user.id,
          })) as Prisma.ThreatCreateManyInput[],
        });
      }

      logAudit({
        action: "CREATE",
        resourceType: "THREAT_MODEL",
        resourceId: model.id,
        resourceName: model.name,
        userId: user.id,
        userEmail: user.email || "unknown",
        organizationId: "",
        metadata: { type: "tool_import", source: imported.source },
      }).catch((err) => logger.warn({ err }, "Audit log failed"));

      return sendCreated(reply, {
        modelId: model.id,
        modelName: model.name,
        source: imported.source,
        componentCount: imported.components.length,
        connectionCount: imported.connections.length,
        threatCount: imported.threats.length,
        boundaryCount: imported.boundaries.length,
        warnings: imported.warnings,
      });
    },
  );

  /**
   * POST /api/threat-models/import/yaml
   * Import from ThreatForge YAML format.
   */
  fastify.post<{ Body: { content: string; projectId?: string } }>(
    "/api/threat-models/import/yaml",
    PROJECT_ORG_EDITOR,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { content, projectId } = request.body;

      if (!content?.trim()) {
        return sendBadRequest(reply, "YAML content is required");
      }

      const parsed = parseYAMLThreatModel(content);
      if (!parsed) {
        return sendBadRequest(reply, "Invalid YAML format");
      }

      const targetProjectId = await resolveModelTargetProject(
        reply,
        user.id,
        projectId,
      );
      if (!targetProjectId) return reply;

      const nodes = parsed.components.map((c, i) => ({
        id: c.id || `comp-${i}`,
        type: "component",
        position: { x: 100 + (i % 4) * 250, y: 100 + Math.floor(i / 4) * 200 },
        data: {
          label: c.name,
          type: c.type,
          trustLevel: c.trustLevel || "INTERNAL",
          description: c.description,
          ...(c.richLabel ? { richLabel: c.richLabel } : {}),
        },
      }));

      const edges = parsed.connections.map((c, i) => ({
        id: `edge-${i}`,
        source: c.from,
        target: c.to,
        label: c.label,
        data: {
          protocol: c.protocol,
          encrypted: c.encrypted,
          authMethod: c.authMethod,
        },
      }));

      const model = await prisma.threatModel.create({
        data: {
          name: parsed.name,
          projectId: targetProjectId,
          createdById: user.id,
          canvasState: JSON.stringify({ nodes, edges }),
        },
      });

      // Create threats
      if (parsed.threats.length > 0) {
        await prisma.threat.createMany({
          data: parsed.threats.map((t) => ({
            threatModelId: model.id,
            name: t.name,
            description: t.description || null,
            strideCategories: JSON.stringify([t.stride]),
            severity: (t.severity || "MEDIUM") as Severity,
            status: (t.status || "OPEN") as ThreatStatus,
            createdById: user.id,
          })) as Prisma.ThreatCreateManyInput[],
        });
      }

      // Create mitigations (link to threats by name)
      if (parsed.mitigations.length > 0 && parsed.threats.length > 0) {
        const dbThreats = await prisma.threat.findMany({
          where: { threatModelId: model.id },
          select: { id: true, name: true },
        });
        const threatNameMap = new Map(dbThreats.map((t) => [t.name, t.id]));

        for (const mit of parsed.mitigations) {
          const threatId = threatNameMap.get(mit.threat);
          if (threatId) {
            await (
              prisma.mitigation.create as (
                ...args: unknown[]
              ) => Promise<unknown>
            )({
              data: {
                threatId,
                description: mit.description,
                status: mit.status || "NOT_IMPLEMENTED",
                priority: mit.priority || "MEDIUM",
                strategy: mit.strategy || "PREVENTION",
              },
            });
          }
        }
      }

      logAudit({
        action: "CREATE",
        resourceType: "THREAT_MODEL",
        resourceId: model.id,
        resourceName: model.name,
        userId: user.id,
        userEmail: user.email || "unknown",
        organizationId: "",
        metadata: { type: "yaml_import" },
      }).catch((err) => logger.warn({ err }, "Audit log failed"));

      return sendCreated(reply, {
        modelId: model.id,
        modelName: model.name,
        componentCount: parsed.components.length,
        connectionCount: parsed.connections.length,
        threatCount: parsed.threats.length,
        mitigationCount: parsed.mitigations.length,
      });
    },
  );

  /**
   * POST /api/threat-models/import/kubernetes
   * Parse Kubernetes YAML manifests and create a threat model.
   */
  fastify.post<{
    Body: { content: string; name?: string; projectId?: string };
  }>(
    "/api/threat-models/import/kubernetes",
    PROJECT_ORG_EDITOR,
    async (request, reply) => {
      return handleIacImport(request, reply, {
        missingContentError: "Kubernetes YAML content is required",
        parse: parseKubernetes,
        noResourcesError:
          "No recognizable Kubernetes resources found in the file",
        describe: (c) => `Kubernetes: ${c.k8sKind} (${c.namespace})`,
        defaultName: "Kubernetes Import",
        auditType: "kubernetes_import",
      });
    },
  );

  /**
   * POST /api/threat-models/import/docker-compose
   * Parse docker-compose.yml and create a threat model.
   */
  fastify.post<{
    Body: { content: string; name?: string; projectId?: string };
  }>(
    "/api/threat-models/import/docker-compose",
    PROJECT_ORG_EDITOR,
    async (request, reply) => {
      return handleIacImport(request, reply, {
        missingContentError: "Docker Compose content is required",
        parse: parseDockerCompose,
        noResourcesError:
          "No recognizable services found in the docker-compose file",
        describe: (c) =>
          c.image ? `Docker: ${c.image}` : "Docker Compose service",
        defaultName: "Docker Compose Import",
        auditType: "docker_compose_import",
      });
    },
  );

  /**
   * GET /api/threat-models/:id/export/yaml
   * Export a threat model as YAML.
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/threat-models/:id/export/yaml",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      if (!(await authorizeModelExport(reply, user.id, id))) {
        return reply;
      }

      const model = await prisma.threatModel.findUnique({
        where: { id },
        include: {
          components: true,
          connections: true,
          boundaries: true,
          threats: { include: { mitigations: true } },
        },
      });

      if (!model) {
        return sendNotFound(reply, "Threat model");
      }

      // richLabel lives only in the canvas JSON (no component column)
      const richLabels = new Map<string, string>();
      try {
        const canvas = JSON.parse(model.canvasState) as {
          nodes?: Array<{ id?: string; data?: { richLabel?: unknown } }>;
        };
        for (const n of canvas.nodes ?? []) {
          const rich = normalizeRichLabel(n.data?.richLabel);
          if (n.id && rich) richLabels.set(n.id, rich);
        }
      } catch {
        // malformed canvas state: export without rich labels
      }

      const yaml = exportToYAML({
        name: model.name,
        components: model.components.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          data: {
            trustLevel: c.trustLevel,
            description: c.description,
            richLabel: richLabels.get(c.nodeId) ?? richLabels.get(c.id),
          },
        })),
        connections: model.connections.map((c) => ({
          source: c.sourceComponentId,
          target: c.targetComponentId,
          label: c.label ?? undefined,
          data: { protocol: c.protocol, encrypted: c.encrypted },
        })),
        boundaries: model.boundaries.map((b) => ({
          name: b.name,
          componentIds: [], // Would need boundary membership data
        })),
        threats: model.threats.map((t) => ({
          name: t.name,
          description: t.description ?? undefined,
          strideCategories: t.strideCategories || "[]",
          severity: t.severity,
          status: t.status,
          componentNodeId: t.componentNodeId,
        })),
        mitigations: model.threats.flatMap((t) =>
          t.mitigations.map((m) => ({
            description: m.description,
            status: m.status,
            priority: m.priority,
            strategy: m.strategy ?? undefined,
            threat: { name: t.name },
          })),
        ),
      });

      reply.header("Content-Type", "text/yaml");
      reply.header(
        "Content-Disposition",
        `attachment; filename="${model.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.yaml"`,
      );
      return reply.send(yaml);
    },
  );
};
