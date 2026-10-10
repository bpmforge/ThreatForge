/**
 * CI/CD API - Zod Schemas
 */
import { z } from "zod";

const CISourceTypeEnum = z.enum([
  "GITHUB",
  "GITLAB",
  "BITBUCKET",
  "AZURE_DEVOPS",
]);
const SeverityEnum = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]);

export const CreateScanSchema = z.object({
  threatModelId: z.string(),
  repositoryId: z.string(),
  commitSha: z.string(),
  prNumber: z.number().optional(),
  baseBranch: z.string().optional(),
  headBranch: z.string().optional(),
  sourceType: CISourceTypeEnum.optional().default("GITHUB"),
  failOnSeverity: SeverityEnum.optional(),
});

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().min(1).max(365).optional(),
  scopes: z.array(z.string()).optional().default(["ci:scan"]),
});

export type Severity = z.infer<typeof SeverityEnum>;
