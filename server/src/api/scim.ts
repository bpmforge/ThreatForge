/**
 * SCIM 2.0 Provisioning Endpoints
 *
 * Implements core SCIM 2.0 for automated user provisioning from IdPs
 * (Okta, Azure AD, OneLogin, etc.).
 *
 * Auth: per-org bearer token stored in scim_tokens table (SHA-256 hash).
 * All operations are scoped to the organization the token belongs to.
 */
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { createHash } from "crypto";
import { getPrisma } from "../db.js";
import logger from "../utils/logger.js";
import { routeAuthz } from "../middleware/authz-policy.js";

const SCIM_SCHEMA_USER = "urn:ietf:params:scim:schemas:core:2.0:User";
const SCIM_SCHEMA_GROUP = "urn:ietf:params:scim:schemas:core:2.0:Group";
const SCIM_SCHEMA_LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const SCIM_ERROR = "urn:ietf:params:scim:api:messages:2.0:Error";

function toScimUser(
  user: {
    id: string;
    name: string | null;
    email: string;
    status?: string;
    createdAt?: Date;
  },
  orgId?: string,
) {
  return {
    schemas: [SCIM_SCHEMA_USER],
    id: user.id,
    userName: user.email,
    name: {
      formatted: user.name || user.email,
      givenName: user.name?.split(" ")[0] || "",
      familyName: user.name?.split(" ").slice(1).join(" ") || "",
    },
    emails: [{ value: user.email, primary: true, type: "work" }],
    active: (user.status || "ACTIVE") === "ACTIVE",
    meta: {
      resourceType: "User",
      created: user.createdAt?.toISOString(),
      location: `/api/scim/v2/Users/${user.id}`,
    },
    ...(orgId
      ? {
          "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
            organization: orgId,
          },
        }
      : {}),
  };
}

/** Validate SCIM bearer token against DB; returns organizationId or null */
/**
 * An org's SCIM token may change a user's global account (email, name, login
 * status) only when that org owns the account: it was SCIM-provisioned, is not
 * a super admin, and belongs to no other org. Anything else is a person with
 * their own account, and one tenant's IdP must not be able to rename, lock or
 * take over it — it may only manage that person's membership in this org.
 */
async function orgOwnsUserAccount(
  userId: string,
  orgId: string,
): Promise<boolean> {
  const prisma = await getPrisma();
  const [user, otherOrgs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { scimProvisioned: true, isSuperAdmin: true },
    }),
    prisma.membership.count({
      where: { userId, organizationId: { not: orgId } },
    }),
  ]);
  return Boolean(
    user?.scimProvisioned && !user.isSuperAdmin && otherOrgs === 0,
  );
}

/**
 * The org membership a SCIM request may change, or null after replying 404
 * (not a member) or 403 (owners are managed in ThreatForge, not by the IdP).
 */
async function findManageableMembership(
  orgId: string,
  userId: string,
  reply: FastifyReply,
) {
  const prisma = await getPrisma();
  // nosemgrep: tf-membership-query-missing-status -- SCIM provisions/deprovisions members of every status
  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId },
    include: { user: true },
  });
  if (!membership) {
    await reply.status(404).send({
      schemas: [SCIM_ERROR],
      status: "404",
      detail: "User not found",
    });
    return null;
  }
  if (membership.role === "OWNER") {
    await reply.status(403).send({
      schemas: [SCIM_ERROR],
      status: "403",
      detail:
        "Organization owners are managed in ThreatForge, not through SCIM",
    });
    return null;
  }
  return membership;
}

async function resolveScimOrg(
  authHeader: string | undefined,
): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const raw = authHeader.slice(7).trim();
  if (!raw) return null;

  const hash = createHash("sha256").update(raw).digest("hex");
  const prisma = await getPrisma();

  const record = await prisma.scimToken.findFirst({
    where: { tokenHash: hash, revokedAt: null },
    select: { id: true, organizationId: true },
  });
  if (!record) return null;

  // Update lastUsedAt async — don't block the request
  prisma.scimToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return record.organizationId;
}

declare module "fastify" {
  interface FastifyRequest {
    scimOrgId?: string;
  }
}

const SCIM_BEARER = routeAuthz({
  public:
    "no user session: the scim preHandler resolves the org from its SCIM bearer token",
});

export const scimRoutes: FastifyPluginAsync = async (server) => {
  // Auth: resolve org from bearer token, attach to request
  server.addHook("preHandler", async (request, reply) => {
    const orgId = await resolveScimOrg(request.headers.authorization);
    if (!orgId) {
      return reply.status(401).send({
        schemas: [SCIM_ERROR],
        status: "401",
        detail: "Invalid or missing SCIM bearer token",
      });
    }
    request.scimOrgId = orgId;
  });

  /** GET /scim/v2/Users — list org members */
  server.get<{
    Querystring: { filter?: string; startIndex?: string; count?: string };
  }>("/scim/v2/Users", SCIM_BEARER, async (request) => {
    const orgId = request.scimOrgId!;
    const { filter, startIndex: si, count: cnt } = request.query;
    const startIndex = Math.max(1, parseInt(si || "1", 10) || 1);
    const count = Math.min(100, Math.max(1, parseInt(cnt || "100", 10) || 100));

    const prisma = await getPrisma();

    let emailFilter: string | undefined;
    if (filter) {
      const m = filter.match(/userName\s+eq\s+"([^"]+)"/i);
      if (m) emailFilter = m[1];
    }

    const membershipWhere = {
      organizationId: orgId,
      status: "ACTIVE" as const,
      ...(emailFilter ? { user: { email: emailFilter } } : {}),
    };

    const [memberships, total] = await Promise.all([
      // nosemgrep: tf-membership-query-missing-status -- status: "ACTIVE" is in membershipWhere above
      prisma.membership.findMany({
        where: membershipWhere,
        skip: startIndex - 1,
        take: count,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.membership.count({ where: membershipWhere }),
    ]);

    return {
      schemas: [SCIM_SCHEMA_LIST],
      totalResults: total,
      startIndex,
      itemsPerPage: count,
      Resources: memberships.map((m) => toScimUser(m.user, orgId)),
    };
  });

  /** GET /scim/v2/Users/:id — get org member */
  server.get<{ Params: { id: string } }>(
    "/scim/v2/Users/:id",
    SCIM_BEARER,
    async (request, reply) => {
      const orgId = request.scimOrgId!;
      const prisma = await getPrisma();

      // nosemgrep: tf-membership-query-missing-status -- SCIM provisions/deprovisions members of every status
      const membership = await prisma.membership.findFirst({
        where: { organizationId: orgId, userId: request.params.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });
      if (!membership) {
        return reply.status(404).send({
          schemas: [SCIM_ERROR],
          status: "404",
          detail: "User not found",
        });
      }
      return toScimUser(membership.user, orgId);
    },
  );

  /** POST /scim/v2/Users — provision user into org */
  server.post<{
    Body: {
      schemas: string[];
      userName: string;
      name?: { givenName?: string; familyName?: string };
      emails?: Array<{ value: string }>;
      active?: boolean;
      externalId?: string;
    };
  }>("/scim/v2/Users", SCIM_BEARER, async (request, reply) => {
    const orgId = request.scimOrgId!;
    const { userName, name: scimName, emails, externalId } = request.body;
    const email = emails?.[0]?.value || userName;
    const displayName =
      [scimName?.givenName, scimName?.familyName].filter(Boolean).join(" ") ||
      email;

    const prisma = await getPrisma();

    // Upsert: find or create the user account
    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
      },
    });

    let createdNow = false;
    if (!user) {
      createdNow = true;
      user = await prisma.user.create({
        data: {
          email,
          name: displayName,
          status: "ACTIVE",
          emailVerified: new Date(),
          scimProvisioned: true,
          ...(externalId ? { scimExternalId: externalId } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
        },
      });
    }

    // Add org membership if not already a member
    // nosemgrep: tf-membership-query-missing-status -- SCIM provisions/deprovisions members of every status
    const existing = await prisma.membership.findFirst({
      where: { organizationId: orgId, userId: user.id },
    });
    if (!existing && !createdNow) {
      // An account that already exists joins an org by invitation, never by
      // another tenant's SCIM token alone.
      return reply.status(409).send({
        schemas: [SCIM_ERROR],
        status: "409",
        scimType: "uniqueness",
        detail:
          "A user with this email already exists. Invite them to the organization instead.",
      });
    }
    if (externalId && existing && (await orgOwnsUserAccount(user.id, orgId))) {
      await prisma.user.update({
        where: { id: user.id },
        data: { scimExternalId: externalId },
      });
    }
    if (!existing) {
      await prisma.membership.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          role: "VIEWER",
          status: "ACTIVE",
        },
      });
    } else if (existing.status === "SUSPENDED") {
      // A PENDING membership is an invitation; only the invitee can accept it.
      await prisma.membership.update({
        where: { id: existing.id },
        data: { status: "ACTIVE" },
      });
    }

    logger.info({ userId: user.id, email, orgId }, "SCIM: User provisioned");
    return reply.status(201).send(toScimUser(user, orgId));
  });

  /** PATCH /scim/v2/Users/:id — update user attributes */
  server.patch<{
    Params: { id: string };
    Body: {
      schemas: string[];
      Operations: Array<{ op: string; path?: string; value?: unknown }>;
    };
  }>("/scim/v2/Users/:id", SCIM_BEARER, async (request, reply) => {
    const orgId = request.scimOrgId!;
    const prisma = await getPrisma();

    const membership = await findManageableMembership(
      orgId,
      request.params.id,
      reply,
    );
    if (!membership) return reply;

    const user = membership.user;
    const userUpdates: Record<string, unknown> = {};
    const memberUpdates: Record<string, unknown> = {};

    for (const op of request.body.Operations || []) {
      const path = op.path?.toLowerCase() ?? "";
      if (path === "active" || path.includes(":active")) {
        const active = op.value === true || op.value === "true";
        userUpdates.status = active ? "ACTIVE" : "SUSPENDED";
        memberUpdates.status = active ? "ACTIVE" : "SUSPENDED";
      }
      if (path === "name.givenname")
        userUpdates.name =
          `${String(op.value)} ${(user.name || "").split(" ").slice(1).join(" ")}`.trim();
      if (path === "name.familyname")
        userUpdates.name =
          `${(user.name || "").split(" ")[0]} ${String(op.value)}`.trim();
      if (
        path === "username" ||
        path.includes('emails[type eq "work"].value')
      ) {
        userUpdates.email = String(op.value);
      }
    }

    if (
      Object.keys(userUpdates).length &&
      (await orgOwnsUserAccount(user.id, orgId))
    ) {
      await prisma.user.update({ where: { id: user.id }, data: userUpdates });
    } else if (Object.keys(userUpdates).length) {
      logger.warn(
        { userId: user.id, orgId, fields: Object.keys(userUpdates) },
        "SCIM: ignored account-level update for a user this org does not own",
      );
    }
    if (Object.keys(memberUpdates).length)
      await prisma.membership.update({
        where: { id: membership.id },
        data: memberUpdates,
      });

    logger.info({ userId: user.id, orgId }, "SCIM: User updated");
    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
      },
    });
    return toScimUser(updated!, orgId);
  });

  /** DELETE /scim/v2/Users/:id — deactivate membership */
  server.delete<{ Params: { id: string } }>(
    "/scim/v2/Users/:id",
    SCIM_BEARER,
    async (request, reply) => {
      const orgId = request.scimOrgId!;
      const prisma = await getPrisma();

      const membership = await findManageableMembership(
        orgId,
        request.params.id,
        reply,
      );
      if (!membership) return reply;

      await prisma.membership.update({
        where: { id: membership.id },
        data: { status: "SUSPENDED" },
      });
      logger.info(
        { userId: request.params.id, orgId },
        "SCIM: User deprovisioned",
      );
      return reply.status(204).send();
    },
  );

  /** GET /scim/v2/Groups — list org custom roles as groups */
  server.get("/scim/v2/Groups", SCIM_BEARER, async (request) => {
    const orgId = request.scimOrgId!;
    const prisma = await getPrisma();

    const roles = await prisma.customRole.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, createdAt: true },
    });

    return {
      schemas: [SCIM_SCHEMA_LIST],
      totalResults: roles.length,
      startIndex: 1,
      itemsPerPage: roles.length,
      Resources: roles.map((r) => ({
        schemas: [SCIM_SCHEMA_GROUP],
        id: r.id,
        displayName: r.name,
        meta: {
          resourceType: "Group",
          created: r.createdAt.toISOString(),
          location: `/api/scim/v2/Groups/${r.id}`,
        },
      })),
    };
  });

  /** GET /scim/v2/Groups/:id — get group with members */
  server.get<{ Params: { id: string } }>(
    "/scim/v2/Groups/:id",
    SCIM_BEARER,
    async (request, reply) => {
      const orgId = request.scimOrgId!;
      const prisma = await getPrisma();

      const role = await prisma.customRole.findFirst({
        where: { id: request.params.id, organizationId: orgId },
      });
      if (!role) {
        return reply.status(404).send({
          schemas: [SCIM_ERROR],
          status: "404",
          detail: "Group not found",
        });
      }

      const members = await prisma.membership.findMany({
        where: {
          organizationId: orgId,
          customRoleId: role.id,
          status: "ACTIVE",
        },
        include: { user: { select: { id: true, email: true } } },
      });

      return {
        schemas: [SCIM_SCHEMA_GROUP],
        id: role.id,
        displayName: role.name,
        members: members.map((m) => ({
          value: m.user.id,
          display: m.user.email,
          $ref: `/api/scim/v2/Users/${m.user.id}`,
        })),
        meta: {
          resourceType: "Group",
          created: role.createdAt.toISOString(),
          location: `/api/scim/v2/Groups/${role.id}`,
        },
      };
    },
  );

  /** GET /scim/v2/ServiceProviderConfig — capabilities advertisement */
  server.get("/scim/v2/ServiceProviderConfig", SCIM_BEARER, async () => ({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 100 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        type: "oauthbearertoken",
        name: "OAuth Bearer Token",
        description: "Authentication using the Bearer Token standard",
        specUri: "http://www.rfc-editor.org/info/rfc6750",
      },
    ],
  }));
};
