/**
 * Document Extraction Prompts Index
 *
 * Re-exports all extraction prompts by document type.
 */

// General architecture extraction
export {
  ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT,
  ARCHITECTURE_EXTRACTION_USER_PROMPT,
} from "./architecture.js";

// SRS (Software Requirements Specification)
export {
  SRS_EXTRACTION_SYSTEM_PROMPT,
  SRS_EXTRACTION_USER_PROMPT,
} from "./srs.js";

// ADR (Architecture Decision Records)
export {
  ADR_EXTRACTION_SYSTEM_PROMPT,
  ADR_EXTRACTION_USER_PROMPT,
} from "./adr.js";

// OpenAPI/Swagger specifications
export {
  OPENAPI_EXTRACTION_SYSTEM_PROMPT,
  OPENAPI_EXTRACTION_USER_PROMPT,
} from "./openapi.js";

// IaC (Terraform, CloudFormation)
export {
  IAC_EXTRACTION_SYSTEM_PROMPT,
  IAC_EXTRACTION_USER_PROMPT,
} from "./iac.js";

// Vision/Diagram images
export {
  DIAGRAM_IMAGE_SYSTEM_PROMPT,
  DIAGRAM_IMAGE_USER_PROMPT,
} from "./vision.js";
