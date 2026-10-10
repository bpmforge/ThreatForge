/**
 * Component Templates Feature - Types
 */

export type ComponentType =
  | "EXTERNAL_USER"
  | "INTERNAL_USER"
  | "EXTERNAL_SYSTEM"
  | "SERVICE"
  | "API"
  | "FUNCTION"
  | "PROCESS"
  | "DATABASE"
  | "FILE_STORAGE"
  | "CACHE"
  | "QUEUE"
  | "LOAD_BALANCER"
  | "FIREWALL"
  | "API_GATEWAY";

export interface ComponentTemplateLibrary {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isPublic: boolean;
  organizationId?: string | null;
  isOwned?: boolean;
  templateCount?: number;
  templates?: ComponentTemplate[];
  createdAt: string;
  updatedAt: string;
}

export interface ComponentTemplate {
  id: string;
  name: string;
  description?: string | null;
  componentType: ComponentType;
  icon?: string | null;
  color?: string | null;
  defaultProperties: Record<string, unknown>;
  suggestedThreats: string[];
  tags: string[];
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
  description?: string;
  componentType: ComponentType;
  icon?: string;
  color?: string;
  defaultProperties?: Record<string, unknown>;
  suggestedThreats?: string[];
  tags?: string[];
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string | null;
  componentType?: ComponentType;
  icon?: string | null;
  color?: string | null;
  defaultProperties?: Record<string, unknown>;
  suggestedThreats?: string[];
  tags?: string[];
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
    ComponentTemplate,
    "id" | "libraryId" | "createdAt" | "updatedAt"
  >[];
}
