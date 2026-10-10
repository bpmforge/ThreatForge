/**
 * Document Type Detection
 *
 * Patterns and logic for detecting document types for smart prompt selection.
 */

/** Document type detection keyword patterns */
const DOCUMENT_TYPE_PATTERNS = {
  srs: [
    "software requirements specification",
    "functional requirements",
    "non-functional requirements",
    "use case",
    "user story",
    "actor",
    "system shall",
    "the system must",
    "acceptance criteria",
    "ieee 830",
    "product scope",
    "user characteristics",
    "assumptions and dependencies",
    "external interface requirements",
  ],
  architecture: [
    "architecture",
    "system design",
    "component diagram",
    "data flow",
    "microservice",
    "deployment diagram",
    "infrastructure",
    "technical design",
    "class diagram",
    "high-level design",
    "low-level design",
    "hld",
    "lld",
  ],
  adr: [
    "architecture decision record",
    "adr-",
    "decision:",
    "status: accepted",
    "status: proposed",
    "status: deprecated",
    "context and problem",
    "decision drivers",
    "considered options",
    "decision outcome",
    "pros and cons",
  ],
  openapi: [
    "openapi:",
    "swagger:",
    '"openapi"',
    '"swagger"',
    "paths:",
    "/api/",
    "components:",
    "schemas:",
    "securityDefinitions",
    "securitySchemes",
    "requestBody:",
    "responses:",
    "application/json",
  ],
  terraform: [
    'resource "',
    'provider "',
    'module "',
    'variable "',
    'output "',
    "terraform {",
    "aws_",
    "azurerm_",
    "google_",
    "security_group",
    "vpc",
    "subnet",
    "iam_role",
    "iam_policy",
  ],
  cloudformation: [
    "AWSTemplateFormatVersion",
    "Resources:",
    "AWS::",
    "Type: AWS::",
    "Fn::",
    "!Ref",
    "!Sub",
    "!GetAtt",
    "SecurityGroup",
    "AWS::EC2::",
    "AWS::IAM::",
    "AWS::Lambda::",
  ],
  threatModel: [
    "threat model",
    "stride",
    "attack tree",
    "attack surface",
    "security assessment",
    "risk assessment",
    "vulnerability",
  ],
};

/** All supported document types */
export type DocumentType =
  | "srs"
  | "architecture"
  | "adr"
  | "openapi"
  | "terraform"
  | "cloudformation"
  | "threatModel"
  | "generic";

/** Detect document type from content */
export function detectDocumentType(content: string): DocumentType {
  const lowerContent = content.toLowerCase();

  const scores: Record<string, number> = {
    srs: 0,
    architecture: 0,
    adr: 0,
    openapi: 0,
    terraform: 0,
    cloudformation: 0,
    threatModel: 0,
  };

  for (const [type, patterns] of Object.entries(DOCUMENT_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerContent.includes(pattern.toLowerCase())) {
        scores[type]++;
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore < 2) return "generic";

  const detected = Object.entries(scores).find(
    ([, score]) => score === maxScore,
  )?.[0];
  return (detected as DocumentType) || "generic";
}
