/**
 * GitHub Integration - Schemas
 */
import { z } from "zod";

export const GitHubConfigSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  baseUrl: z.string().url().optional().default("https://api.github.com"),
  defaultLabels: z.array(z.string()).optional().default(["threat-model"]),
  threatLabelPrefix: z.string().optional().default("threat:"),
  mitigationLabelPrefix: z.string().optional().default("mitigation:"),
  autoCreateIssues: z.boolean().optional().default(false),
  syncDirection: z
    .enum(["PUSH_ONLY", "PULL_ONLY", "BIDIRECTIONAL"])
    .optional()
    .default("PUSH_ONLY"),
});

export const GitHubCredentialsSchema = z.object({
  type: z.enum(["pat", "github_app"]),
  token: z.string().optional(),
  appId: z.string().optional(),
  installationId: z.string().optional(),
  privateKey: z.string().optional(),
});

export const CreateIssueSchema = z.object({
  threatId: z.string().optional(),
  mitigationId: z.string().optional(),
  title: z.string().min(1).max(255),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  milestone: z.number().optional(),
});

export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;
export type GitHubCredentials = z.infer<typeof GitHubCredentialsSchema>;
