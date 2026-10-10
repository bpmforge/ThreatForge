/**
 * Threat Library API - Validation Schemas
 */
import { z } from "zod";

export const CreateLibrarySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export const UpdateLibrarySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
});

const ComplianceFrameworkEnum = z.enum([
  "SOC2",
  "ISO27001",
  "NIST_CSF",
  "NIST_800_53",
  "PCI_DSS",
  "HIPAA",
  "GDPR",
]);
const ComplianceControlsSchema = z
  .record(ComplianceFrameworkEnum, z.array(z.string()))
  .optional();

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  strideCategory: z.enum([
    "SPOOFING",
    "TAMPERING",
    "REPUDIATION",
    "INFORMATION_DISCLOSURE",
    "DENIAL_OF_SERVICE",
    "ELEVATION_OF_PRIVILEGE",
  ]),
  defaultSeverity: z
    .enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"])
    .optional(),
  applicableComponentTypes: z.array(z.string()).optional(),
  suggestedMitigations: z.array(z.string()).optional(),
  complianceControls: ComplianceControlsSchema,
  cweIds: z.array(z.string()).optional(),
  owaspIds: z.array(z.string()).optional(),
});

export const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  strideCategory: z
    .enum([
      "SPOOFING",
      "TAMPERING",
      "REPUDIATION",
      "INFORMATION_DISCLOSURE",
      "DENIAL_OF_SERVICE",
      "ELEVATION_OF_PRIVILEGE",
    ])
    .optional(),
  defaultSeverity: z
    .enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"])
    .optional(),
  applicableComponentTypes: z.array(z.string()).optional(),
  suggestedMitigations: z.array(z.string()).optional(),
  complianceControls: ComplianceControlsSchema,
  cweIds: z.array(z.string()).optional(),
  owaspIds: z.array(z.string()).optional(),
});

export const ImportLibrarySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  templates: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      strideCategory: z.enum([
        "SPOOFING",
        "TAMPERING",
        "REPUDIATION",
        "INFORMATION_DISCLOSURE",
        "DENIAL_OF_SERVICE",
        "ELEVATION_OF_PRIVILEGE",
      ]),
      defaultSeverity: z
        .enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"])
        .optional(),
      applicableComponentTypes: z.array(z.string()).optional(),
      suggestedMitigations: z.array(z.string()).optional(),
      complianceControls: ComplianceControlsSchema,
      cweIds: z.array(z.string()).optional(),
      owaspIds: z.array(z.string()).optional(),
    }),
  ),
});
