/**
 * Supply Chain Analysis API
 *
 * POST /api/supply-chain/scan — Parse dependency file and check for vulnerabilities
 */
import type { FastifyPluginAsync } from "fastify";
import { getAuthUser } from "../utils/auth-helpers.js";
import { sendSuccess, sendBadRequest } from "../utils/api-response.js";
import {
  parseDependencies,
  scanDependencies,
} from "../services/supply-chain/dependency-scanner.js";
import { routeAuthz } from "../middleware/authz-policy.js";

const AUTHENTICATED = routeAuthz("authenticated");

export const supplyChainRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/supply-chain/scan
   * Parse a dependency file and scan for known vulnerabilities.
   */
  server.post<{
    Body: { content: string; filename?: string; scanNVD?: boolean };
  }>("/api/supply-chain/scan", AUTHENTICATED, async (request, reply) => {
    getAuthUser(request); // Verify auth
    const { content, filename, scanNVD = true } = request.body;

    if (!content?.trim()) {
      return sendBadRequest(reply, "Dependency file content is required");
    }

    const deps = parseDependencies(content, filename);

    if (deps.length === 0) {
      return sendBadRequest(
        reply,
        "No dependencies found. Supported: package.json, requirements.txt, go.mod, pom.xml, Cargo.toml",
      );
    }

    // With scanNVD=false nothing is looked up, so every dependency is
    // reported UNKNOWN (not verified) rather than NONE.
    const report = await scanDependencies(deps, scanNVD ? 10 : 0);
    return sendSuccess(reply, report);
  });
};
