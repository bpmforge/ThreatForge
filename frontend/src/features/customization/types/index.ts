/**
 * Customization feature types
 */

// Custom Threat Categories
export interface CustomThreatCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> {
  isActive?: boolean;
}

// Mitigation Libraries
export interface MitigationLibrary {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  templateCount: number;
  createdBy: { name: string | null; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface MitigationTemplate {
  id: string;
  libraryId: string;
  name: string;
  description: string;
  strategy: MitigationStrategy;
  effort: EffortLevel;
  effectiveness: EffectivenessLevel;
  applicableThreatTypes: string[];
  complianceControls: Record<string, string[]>;
  implementationSteps: string[];
  prerequisites: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type MitigationStrategy =
  | "PREVENTION"
  | "DETECTION"
  | "RESPONSE"
  | "RECOVERY"
  | "DETERRENCE";

export type EffortLevel = "TRIVIAL" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
export type EffectivenessLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export interface CreateLibraryData {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export interface CreateTemplateData {
  name: string;
  description: string;
  strategy: MitigationStrategy;
  effort?: EffortLevel;
  effectiveness?: EffectivenessLevel;
  applicableThreatTypes?: string[];
  complianceControls?: Record<string, string[]>;
  implementationSteps?: string[];
  prerequisites?: string[];
  tags?: string[];
}
