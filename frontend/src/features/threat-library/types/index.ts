/**
 * Threat Library types.
 */
import type { StrideCategory, Severity, ComponentType } from "@/types/canvas";

/** A threat template from the library */
export interface LibraryThreat {
  id: string;
  name: string;
  description: string;
  /** STRIDE categories this threat maps to (can be multiple) */
  strideCategories: StrideCategory[];
  defaultSeverity: Severity;
  /** Component types this threat is relevant to */
  applicableTo: ComponentType[];
  /** Example attack scenarios */
  attackScenarios?: string[];
  /** Suggested mitigations */
  suggestedMitigations?: string[];
  /** OWASP/CWE reference IDs */
  references?: string[];
}

/** Grouped threats by STRIDE category */
export interface ThreatsByCategory {
  SPOOFING: LibraryThreat[];
  TAMPERING: LibraryThreat[];
  REPUDIATION: LibraryThreat[];
  INFORMATION_DISCLOSURE: LibraryThreat[];
  DENIAL_OF_SERVICE: LibraryThreat[];
  ELEVATION_OF_PRIVILEGE: LibraryThreat[];
}

/** Filter options for the library browser */
export interface LibraryFilters {
  search: string;
  category: StrideCategory | "ALL";
  componentType: ComponentType | "ALL";
}

// =============================================================================
// API-based Threat Library Management Types
// =============================================================================

/** Managed threat library from the API */
export interface ThreatLibrary {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isPublic: boolean;
  organizationId?: string | null;
  isOwned?: boolean;
  templateCount?: number;
  templates?: ThreatTemplate[];
  createdAt: string;
  updatedAt: string;
}

/** Supported compliance framework identifiers */
export type ComplianceFramework =
  | "SOC2"
  | "ISO27001"
  | "NIST_CSF"
  | "NIST_800_53"
  | "FIPS_140"
  | "FIPS_199"
  | "PCI_DSS"
  | "HIPAA"
  | "GDPR"
  | "CIS_CONTROLS"
  | "OWASP_ASVS"
  | "FEDRAMP";

/** Compliance controls mapping - framework to control IDs */
export type ComplianceControls = Partial<
  Record<ComplianceFramework | string, string[]>
>;

/** Threat template from the API */
export interface ThreatTemplate {
  id: string;
  name: string;
  description: string;
  strideCategory: StrideCategory;
  defaultSeverity: Severity;
  applicableComponentTypes: string[];
  suggestedMitigations: string[];
  /** Compliance framework control mappings */
  complianceControls?: ComplianceControls;
  /** CWE IDs (e.g., ["CWE-89", "CWE-79"]) */
  cweIds?: string[];
  /** OWASP references (e.g., ["A01:2021", "A03:2021"]) */
  owaspIds?: string[];
  libraryId: string;
  createdAt: string;
  updatedAt: string;
}

// Request types
export interface CreateLibraryRequest {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateLibraryRequest {
  name?: string;
  description?: string | null;
  isPublic?: boolean;
}

export interface CreateTemplateRequest {
  name: string;
  description: string;
  strideCategory: StrideCategory;
  defaultSeverity?: Severity;
  applicableComponentTypes?: string[];
  suggestedMitigations?: string[];
  complianceControls?: ComplianceControls;
  cweIds?: string[];
  owaspIds?: string[];
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  strideCategory?: StrideCategory;
  defaultSeverity?: Severity;
  applicableComponentTypes?: string[];
  suggestedMitigations?: string[];
  complianceControls?: ComplianceControls;
  cweIds?: string[];
  owaspIds?: string[];
}

export interface ImportLibraryRequest {
  name: string;
  description?: string;
  templates: Omit<CreateTemplateRequest, "libraryId">[];
}

export interface ExportLibraryResponse {
  name: string;
  description?: string | null;
  templates: Omit<
    ThreatTemplate,
    "id" | "libraryId" | "createdAt" | "updatedAt"
  >[];
}
