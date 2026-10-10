#!/usr/bin/env node
/**
 * ThreatForge MCP Server
 *
 * Exposes ThreatForge data to AI assistants via the Model Context Protocol.
 * Runs over stdio — configure in Claude Code, Cursor, or any MCP-compatible client.
 *
 * Usage:
 *   THREATFORGE_BASE_URL=http://localhost:3001 \
 *   THREATFORGE_API_TOKEN=ftm_... \
 *   node dist/index.js
 *
 * Claude Code settings.json:
 *   {
 *     "mcpServers": {
 *       "threatforge": {
 *         "command": "node",
 *         "args": ["/path/to/tools/mcp-server/dist/index.js"],
 *         "env": {
 *           "THREATFORGE_BASE_URL": "http://localhost:3001",
 *           "THREATFORGE_API_TOKEN": "ftm_..."
 *         }
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClientFromEnv } from "./client.js";
import {
  listModels,
  getModelSummary,
  getThreats,
  getMitigations,
  getComplianceGaps,
  getPortfolioRisk,
  updateMitigationStatus,
  addEvidenceLink,
} from "./tools.js";

const server = new Server(
  { name: "threatforge", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// ── Tool registry ─────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_models",
    description:
      "List all threat models the authenticated user has access to. Returns model IDs and names.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Optional: filter by project ID",
        },
        limit: {
          type: "number",
          description: "Max results to return (default: 20)",
        },
      },
    },
  },
  {
    name: "get_model_summary",
    description:
      "Get a summary of a specific threat model: threat count by severity/status, mitigation rate, and last updated date.",
    inputSchema: {
      type: "object",
      properties: {
        modelId: { type: "string", description: "Threat model ID" },
      },
      required: ["modelId"],
    },
  },
  {
    name: "get_threats",
    description:
      "Get threats for a threat model. Can filter by severity (CRITICAL/HIGH/MEDIUM/LOW) or status (OPEN/IN_PROGRESS/MITIGATED/ACCEPTED_RISK).",
    inputSchema: {
      type: "object",
      properties: {
        modelId: { type: "string", description: "Threat model ID" },
        severity: {
          type: "string",
          enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
          description: "Filter by severity",
        },
        status: {
          type: "string",
          enum: [
            "OPEN",
            "IN_PROGRESS",
            "MITIGATED",
            "ACCEPTED_RISK",
            "FALSE_POSITIVE",
          ],
          description: "Filter by status",
        },
        limit: { type: "number", description: "Max results (default: 20)" },
      },
      required: ["modelId"],
    },
  },
  {
    name: "get_mitigations",
    description:
      "Get mitigations for a specific threat, including their status and evidence links.",
    inputSchema: {
      type: "object",
      properties: {
        modelId: { type: "string", description: "Threat model ID" },
        threatId: { type: "string", description: "Threat ID" },
      },
      required: ["modelId", "threatId"],
    },
  },
  {
    name: "get_compliance_gaps",
    description:
      "Get compliance gap analysis for a threat model against a specific framework (e.g., NIST_800_53, SOC2, PCI_DSS, HIPAA, ISO_27001).",
    inputSchema: {
      type: "object",
      properties: {
        modelId: { type: "string", description: "Threat model ID" },
        framework: {
          type: "string",
          description:
            "Compliance framework identifier, e.g. NIST_800_53, SOC2, PCI_DSS",
        },
      },
      required: ["modelId", "framework"],
    },
  },
  {
    name: "get_portfolio_risk",
    description:
      "Get organization-wide risk aggregation: total models, threats, open critical threats, mitigation rate, and top risks.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Organization ID" },
        period: {
          type: "string",
          description:
            "Time period for trends, e.g. 7d, 30d, 90d (default: 30d)",
        },
      },
      required: ["orgId"],
    },
  },
  {
    name: "update_mitigation_status",
    description:
      "Update the status of a mitigation. Valid statuses: PLANNED, IN_PROGRESS, COMPLETED, VERIFIED.",
    inputSchema: {
      type: "object",
      properties: {
        modelId: { type: "string", description: "Threat model ID" },
        mitigationId: { type: "string", description: "Mitigation ID" },
        status: {
          type: "string",
          enum: ["PLANNED", "IN_PROGRESS", "COMPLETED", "VERIFIED"],
          description: "New status",
        },
      },
      required: ["modelId", "mitigationId", "status"],
    },
  },
  {
    name: "add_evidence_link",
    description:
      "Add an evidence link (ticket, document, test report, scan result) to a mitigation.",
    inputSchema: {
      type: "object",
      properties: {
        modelId: { type: "string", description: "Threat model ID" },
        mitigationId: { type: "string", description: "Mitigation ID" },
        url: { type: "string", description: "URL to the evidence" },
        title: {
          type: "string",
          description: "Human-readable title for the link",
        },
        type: {
          type: "string",
          enum: [
            "ticket",
            "document",
            "screenshot",
            "test_report",
            "scan_result",
            "manual",
          ],
          description: "Evidence type",
        },
      },
      required: ["modelId", "mitigationId", "url"],
    },
  },
];

// ── Request handlers ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  let client;
  try {
    client = createClientFromEnv();
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Configuration error: ${(err as Error).message}`,
        },
      ],
      isError: true,
    };
  }

  try {
    let result: string;

    switch (name) {
      case "list_models":
        result = await listModels(
          client,
          args as Parameters<typeof listModels>[1],
        );
        break;
      case "get_model_summary":
        result = await getModelSummary(
          client,
          args as Parameters<typeof getModelSummary>[1],
        );
        break;
      case "get_threats":
        result = await getThreats(
          client,
          args as Parameters<typeof getThreats>[1],
        );
        break;
      case "get_mitigations":
        result = await getMitigations(
          client,
          args as Parameters<typeof getMitigations>[1],
        );
        break;
      case "get_compliance_gaps":
        result = await getComplianceGaps(
          client,
          args as Parameters<typeof getComplianceGaps>[1],
        );
        break;
      case "get_portfolio_risk":
        result = await getPortfolioRisk(
          client,
          args as Parameters<typeof getPortfolioRisk>[1],
        );
        break;
      case "update_mitigation_status":
        result = await updateMitigationStatus(
          client,
          args as Parameters<typeof updateMitigationStatus>[1],
        );
        break;
      case "add_evidence_link":
        result = await addEvidenceLink(
          client,
          args as Parameters<typeof addEvidenceLink>[1],
        );
        break;
      default:
        result = `Unknown tool: ${name}`;
    }

    return { content: [{ type: "text", text: result }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      isError: true,
    };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("ThreatForge MCP server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
