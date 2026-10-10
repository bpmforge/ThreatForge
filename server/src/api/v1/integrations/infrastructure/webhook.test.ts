/**
 * Unit tests for Infrastructure Change Webhook
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { createHmac } from "crypto";
import { keepRawJsonBody } from "../../../../utils/raw-body.js";
import Fastify, { type FastifyInstance } from "fastify";
import { infrastructureWebhookRoutes } from "./webhook.js";

const SECRET = "org-a-secret";
const ORG_A_URL = "/organizations/org-a/integrations/infrastructure/webhook";

function sign(body: unknown, secret = SECRET): string {
  return (
    "sha256=" +
    createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex")
  );
}

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const mockThreatModels = [
  {
    id: "model-1",
    canvasState: JSON.stringify({
      nodes: [
        {
          id: "node-rds",
          data: { label: "User DB", technology: "aws_rds_instance" },
        },
        {
          id: "node-s3",
          data: { label: "Asset Storage", technology: "aws_s3_bucket" },
        },
      ],
    }),
  },
  {
    id: "model-2",
    canvasState: JSON.stringify({
      nodes: [
        {
          id: "node-lambda",
          data: { label: "API Handler", type: "aws_lambda_function" },
        },
      ],
    }),
  },
];

const mockPrisma = {
  organization: {
    findUnique: vi.fn(),
  },
  threatModel: {
    findMany: vi.fn(),
  },
  threat: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

// ─── App setup ───────────────────────────────────────────────────────────────

describe("POST /organizations/:orgId/integrations/infrastructure/webhook", () => {
  let app: FastifyInstance;

  function signedInject(opts: {
    method: "POST";
    url: string;
    payload: Record<string, unknown>;
  }) {
    return app.inject({
      ...opts,
      headers: { "x-hub-signature-256": sign(opts.payload) },
    });
  }

  beforeAll(async () => {
    app = Fastify();
    keepRawJsonBody(app);
    await infrastructureWebhookRoutes(app, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue({
      ciWebhookSecret: SECRET,
    });
    mockPrisma.threatModel.findMany.mockResolvedValue([]);
    mockPrisma.threat.findMany.mockResolvedValue([]);
    mockPrisma.threat.update.mockResolvedValue({});
  });

  // ── Authentication and tenant scope ─────────────────────────────────────

  const rdsChange = { resourceType: "aws_rds_instance", resourceName: "db" };

  it("rejects an unsigned request without scanning any model", async () => {
    const resp = await app.inject({
      method: "POST",
      url: ORG_A_URL,
      payload: rdsChange,
    });
    expect(resp.statusCode).toBe(401);
    expect(mockPrisma.threatModel.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.threat.update).not.toHaveBeenCalled();
  });

  it("rejects a request signed with another secret", async () => {
    const resp = await app.inject({
      method: "POST",
      url: ORG_A_URL,
      headers: { "x-hub-signature-256": sign(rdsChange, "wrong") },
      payload: rdsChange,
    });
    expect(resp.statusCode).toBe(401);
    expect(mockPrisma.threatModel.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 with setup guidance when the org has no secret", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      ciWebhookSecret: null,
    });
    const resp = await signedInject({
      method: "POST",
      url: ORG_A_URL,
      payload: rdsChange,
    });
    expect(resp.statusCode).toBe(401);
    expect(resp.body).toMatch(/webhook-secret/);
    expect(mockPrisma.threatModel.findMany).not.toHaveBeenCalled();
  });

  it("is no longer reachable on the unscoped global path", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/integrations/infrastructure/webhook",
      payload: rdsChange,
    });
    expect(resp.statusCode).toBe(404);
  });

  it("only scans threat models of :orgId", async () => {
    await signedInject({ method: "POST", url: ORG_A_URL, payload: rdsChange });

    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "org-a" } }),
    );
    expect(mockPrisma.threatModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, project: { organizationId: "org-a" } },
      }),
    );
  });

  // ── Payload validation ──────────────────────────────────────────────────

  it("returns 400 for empty payload with no identifiable resource", async () => {
    const resp = await signedInject({
      method: "POST",
      url: ORG_A_URL,
      payload: {},
    });
    expect(resp.statusCode).toBe(400);
    const body = resp.json();
    expect(body.error ?? body.message).toMatch(/identify|resource/i);
  });

  it("returns 200 for generic payload with resourceType", async () => {
    const resp = await signedInject({
      method: "POST",
      url: ORG_A_URL,
      payload: {
        resourceType: "aws_s3_bucket",
        resourceName: "test-bucket",
        changeType: "UPDATE",
      },
    });
    expect(resp.statusCode).toBe(200);
  });

  // ── Provider detection ──────────────────────────────────────────────────
  // `provider` only appears in the response when affected components are found.
  // Mock a matching model so we reach the full success path.

  it("detects generic provider and echoes resource in response", async () => {
    // Note: top-level `resourceType` triggers AWS Config detection.
    // The generic path is reached when only `resourceName` is present.
    mockPrisma.threatModel.findMany.mockResolvedValue([
      {
        id: "model-x",
        canvasState: JSON.stringify({
          nodes: [{ id: "n1", data: { label: "prod-db", name: "prod-db" } }],
        }),
      },
    ]);
    mockPrisma.threat.findMany.mockResolvedValue([]);

    const resp = await signedInject({
      method: "POST",
      url: ORG_A_URL,
      payload: {
        resourceName: "prod-db",
        changeType: "UPDATE",
      },
    });
    const body = resp.json();
    expect(body.data.provider).toBe("generic");
    expect(body.data.resource).toContain("prod-db");
  });

  it("detects AWS Config provider from configurationItem field", async () => {
    mockPrisma.threatModel.findMany.mockResolvedValue([
      {
        id: "model-x",
        canvasState: JSON.stringify({
          nodes: [{ id: "n1", data: { label: "my-bucket", technology: "s3" } }],
        }),
      },
    ]);
    mockPrisma.threat.findMany.mockResolvedValue([]);

    const resp = await signedInject({
      method: "POST",
      url: ORG_A_URL,
      payload: {
        configurationItem: {},
        resourceType: "AWS::S3::Bucket",
        resourceId: "my-bucket",
        awsRegion: "us-east-1",
        configurationItemStatus: "OK",
      },
    });
    const body = resp.json();
    expect(body.data.provider).toBe("aws-config");
  });

  it("detects Terraform Cloud provider from data.type = 'runs'", async () => {
    mockPrisma.threatModel.findMany.mockResolvedValue([
      {
        id: "model-x",
        canvasState: JSON.stringify({
          nodes: [
            { id: "n1", data: { label: "production", name: "production" } },
          ],
        }),
      },
    ]);
    mockPrisma.threat.findMany.mockResolvedValue([]);

    const resp = await signedInject({
      method: "POST",
      url: ORG_A_URL,
      payload: {
        data: {
          type: "runs",
          attributes: {
            status: "applied",
            "workspace-name": "production",
          },
        },
      },
    });
    const body = resp.json();
    expect(body.data.provider).toBe("terraform-cloud");
  });

  // ── No matching components ──────────────────────────────────────────────

  it("returns processed:true with 0 affected when no models match", async () => {
    mockPrisma.threatModel.findMany.mockResolvedValue([]);

    const resp = await signedInject({
      method: "POST",
      url: ORG_A_URL,
      payload: {
        resourceType: "aws_rds_instance",
        resourceName: "unknown-db",
      },
    });
    const body = resp.json();
    expect(body.data.processed).toBe(true);
    expect(body.data.affectedThreats).toBe(0);
  });

  // ── Matching components ─────────────────────────────────────────────────

  it("finds affected components by technology match", async () => {
    mockPrisma.threatModel.findMany.mockResolvedValue(mockThreatModels);
    mockPrisma.threat.findMany.mockResolvedValue([
      {
        id: "threat-1",
        threatModelId: "model-1",
        componentNodeId: "node-rds",
        status: "OPEN",
        reviewStatus: "ACCEPTED",
      },
    ]);

    const resp = await signedInject({
      method: "POST",
      url: ORG_A_URL,
      payload: {
        resourceType: "aws_rds_instance",
        resourceName: "user-db",
      },
    });
    const body = resp.json();
    expect(body.data.affectedComponents).toBeGreaterThan(0);
  });

  it("marks matching threats as PENDING review", async () => {
    mockPrisma.threatModel.findMany.mockResolvedValue(mockThreatModels);
    mockPrisma.threat.findMany.mockResolvedValue([
      {
        id: "threat-1",
        threatModelId: "model-1",
        componentNodeId: "node-rds",
        status: "OPEN",
      },
      {
        id: "threat-2",
        threatModelId: "model-1",
        componentNodeId: "node-rds",
        status: "OPEN",
      },
    ]);

    await signedInject({
      method: "POST",
      url: ORG_A_URL,
      payload: {
        resourceType: "aws_rds_instance",
        resourceName: "user-db",
      },
    });

    expect(mockPrisma.threat.update).toHaveBeenCalledTimes(2);
    const updateCall = mockPrisma.threat.update.mock.calls[0][0];
    expect(updateCall.data.reviewStatus).toBe("PENDING");
  });

  it("returns affectedThreats count equal to threats flagged", async () => {
    mockPrisma.threatModel.findMany.mockResolvedValue(mockThreatModels);
    mockPrisma.threat.findMany.mockResolvedValue([
      {
        id: "threat-1",
        threatModelId: "model-1",
        componentNodeId: "node-rds",
        status: "OPEN",
      },
    ]);

    const resp = await signedInject({
      method: "POST",
      url: ORG_A_URL,
      payload: {
        resourceType: "aws_rds_instance",
        resourceName: "user-db",
      },
    });
    const body = resp.json();
    expect(body.data.affectedThreats).toBe(1);
  });

  // ── AWS Config DELETE event ─────────────────────────────────────────────

  it("normalizes AWS Config ResourceDeleted as DELETE changeType", async () => {
    mockPrisma.threatModel.findMany.mockResolvedValue([]);

    const resp = await signedInject({
      method: "POST",
      url: ORG_A_URL,
      payload: {
        configurationItem: {},
        resourceType: "AWS::EC2::Instance",
        resourceId: "i-abc123",
        awsRegion: "us-west-2",
        configurationItemStatus: "ResourceDeleted",
      },
    });
    expect(resp.statusCode).toBe(200);
  });

  // ── Terraform Cloud workspace match ─────────────────────────────────────

  it("matches Terraform Cloud workspace name against canvas nodes", async () => {
    mockPrisma.threatModel.findMany.mockResolvedValue([
      {
        id: "model-3",
        canvasState: JSON.stringify({
          nodes: [
            {
              id: "node-ws",
              data: { label: "Prod Workspace", name: "production" },
            },
          ],
        }),
      },
    ]);
    mockPrisma.threat.findMany.mockResolvedValue([]);

    const resp = await signedInject({
      method: "POST",
      url: ORG_A_URL,
      payload: {
        data: {
          type: "runs",
          attributes: {
            status: "applied",
            "workspace-name": "production",
          },
        },
      },
    });
    const body = resp.json();
    expect(body.data.processed).toBe(true);
  });

  // ── Malformed canvas state ──────────────────────────────────────────────

  it("skips models with invalid canvasState JSON", async () => {
    mockPrisma.threatModel.findMany.mockResolvedValue([
      { id: "model-bad", canvasState: "not-json" },
    ]);
    mockPrisma.threat.findMany.mockResolvedValue([]);

    const resp = await signedInject({
      method: "POST",
      url: ORG_A_URL,
      payload: {
        resourceType: "aws_lambda_function",
        resourceName: "my-fn",
      },
    });
    expect(resp.statusCode).toBe(200);
    const body = resp.json();
    // Invalid canvas → no components matched → "no match" early return path
    expect(body.data.affectedThreats).toBe(0);
    expect(body.data.processed).toBe(true);
  });
});
