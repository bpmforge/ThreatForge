/**
 * Go-forward fixture model — real model-load path proof
 *
 * Loads fixture-model.json through the SAME path the save-canvas route uses:
 * CanvasStateSchema validation + syncCanvasToDatabase() against a real
 * (SQLite) database, then asserts the normalized rows the replay harness
 * depends on. No mocks of the load path.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = resolve(__dirname, "../../../../prisma/test.db");

interface FixtureFile {
  name: string;
  canvasState: {
    nodes: Array<{ id: string; type: string; parentId?: string }>;
    edges: Array<{
      id: string;
      data?: {
        protocol?: string;
        authentication?: string;
        encrypted?: boolean;
      };
    }>;
  };
  sequenceDiagrams: Array<{ diagramName: string; messages: unknown[] }>;
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, "fixture-model.json"), "utf8"),
) as FixtureFile;

describe("go-forward fixture model", () => {
  it("has the expected fixture shape", () => {
    const components = fixture.canvasState.nodes.filter(
      (n) => n.type === "component",
    );
    const boundaries = fixture.canvasState.nodes.filter(
      (n) => n.type === "boundary",
    );
    expect(components).toHaveLength(12);
    expect(boundaries).toHaveLength(2);
    expect(fixture.canvasState.edges.length).toBeGreaterThanOrEqual(14);
    // Every connection carries protocol/auth/encryption in edge data
    for (const edge of fixture.canvasState.edges) {
      expect(edge.data?.protocol, `edge ${edge.id} protocol`).toBeTruthy();
      expect(edge.data?.authentication, `edge ${edge.id} auth`).toBeTruthy();
      expect(typeof edge.data?.encrypted, `edge ${edge.id} encrypted`).toBe(
        "boolean",
      );
    }
    // Both boundaries contain children
    for (const boundary of boundaries) {
      const children = components.filter((c) => c.parentId === boundary.id);
      expect(
        children.length,
        `boundary ${boundary.id} children`,
      ).toBeGreaterThan(0);
    }
    expect(fixture.sequenceDiagrams).toHaveLength(1);
    expect(fixture.sequenceDiagrams[0].messages.length).toBeGreaterThan(0);
  });

  describe("real model-load path (CanvasStateSchema + syncCanvasToDatabase)", () => {
    let prisma: PrismaClient;
    let threatModelId: string;

    beforeAll(async () => {
      // Point the app's getPrisma() at the isolated test DB BEFORE anything
      // initializes the client (db.ts caches on first call).
      process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
      const { setupTestDatabase, testData } = await import("../../setup.js");
      prisma = await setupTestDatabase();

      const user = await testData.createUser();
      const org = await testData.createOrganization();
      await testData.createMembership(user.id, org.id);
      const project = await testData.createProject(org.id, user.id);
      const model = await testData.createThreatModel(project.id, user.id, {
        name: fixture.name,
      });
      threatModelId = model.id;
      await prisma.threatModel.update({
        where: { id: threatModelId },
        data: { canvasState: JSON.stringify(fixture.canvasState) },
      });
    });

    afterAll(async () => {
      const { teardownTestDatabase } = await import("../../setup.js");
      await teardownTestDatabase();
    });

    it("passes the save-canvas route's CanvasStateSchema validation", async () => {
      const { CanvasStateSchema } = await import(
        "../../../api/threat-models/schemas.js"
      );
      const parsed = CanvasStateSchema.safeParse(fixture.canvasState);
      expect(parsed.success).toBe(true);
    });

    it("syncs to normalized tables via the real canvas-sync service", async () => {
      const { syncCanvasToDatabase } = await import(
        "../../../services/canvas-sync.js"
      );
      await syncCanvasToDatabase(
        threatModelId,
        JSON.parse(JSON.stringify(fixture.canvasState)),
      );

      const [components, boundaries, connections] = await Promise.all([
        prisma.component.findMany({ where: { threatModelId } }),
        prisma.boundary.findMany({ where: { threatModelId } }),
        prisma.connection.findMany({ where: { threatModelId } }),
      ]);

      expect(components).toHaveLength(12);
      expect(boundaries).toHaveLength(2);
      expect(connections).toHaveLength(15);

      // Boundary nesting survived the load (9 components live in boundaries)
      const nested = components.filter((c) => c.boundaryId !== null);
      expect(nested).toHaveLength(9);

      // Security metadata mapped through PROTOCOL_MAP / AUTH_MAP
      const protocols = new Set(connections.map((c) => c.protocol));
      expect(protocols).toContain("HTTPS");
      expect(protocols).toContain("GRPC");
      expect(protocols).toContain("POSTGRESQL");
      const auths = new Set(connections.map((c) => c.authentication));
      expect(auths).toContain("JWT");
      expect(auths).toContain("MTLS");
      expect(auths).toContain("API_KEY");
      expect(connections.some((c) => c.encrypted === false)).toBe(true);

      // Trust-boundary crossings detected
      expect(connections.some((c) => c.crossesBoundary)).toBe(true);

      // Component type mix per spec (frontend types map via COMPONENT_TYPE_MAP)
      const types = new Set(components.map((c) => c.type));
      expect(types).toContain("SERVICE"); // WEB_APP + MICROSERVICE
      expect(types).toContain("API");
      expect(types).toContain("DATABASE");
      expect(types).toContain("EXTERNAL_SYSTEM"); // EXTERNAL_ENTITY
    });
  });
});
