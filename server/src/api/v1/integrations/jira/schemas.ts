/**
 * JIRA Integration - Zod Schemas
 */
import { z } from "zod";

export const JiraConfigSchema = z.object({
  baseUrl: z.string().url(),
  projectKey: z.string().min(1),
  issueTypeIdThreat: z.string().optional(),
  issueTypeIdMitigation: z.string().optional(),
  priorityMapping: z.record(z.string(), z.string()).optional(),
  statusMapping: z.record(z.string(), z.string()).optional(),
  customFields: z.record(z.string(), z.string()).optional(),
  autoCreateIssues: z.boolean().optional().default(false),
  syncDirection: z
    .enum(["PUSH_ONLY", "PULL_ONLY", "BIDIRECTIONAL"])
    .optional()
    .default("PUSH_ONLY"),
});

export const JiraCredentialsSchema = z.object({
  type: z.enum(["oauth2", "api_token"]),
  email: z.string().email().optional(),
  apiToken: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  cloudId: z.string().optional(),
});

export const CreateIssueSchema = z.object({
  threatId: z.string().optional(),
  mitigationId: z.string().optional(),
  summary: z.string().min(1).max(255),
  description: z.string().optional(),
  issueType: z.string().optional(),
  priority: z.string().optional(),
  labels: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type JiraConfig = z.infer<typeof JiraConfigSchema>;
export type JiraCredentials = z.infer<typeof JiraCredentialsSchema>;
