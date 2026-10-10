/**
 * Model Templates feature types
 */

export interface ModelTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  thumbnail: string | null;
  isPublic: boolean;
  usageCount: number;
  createdBy: { name: string | null; email: string } | null;
  organization: { name: string; slug: string } | null;
  createdAt: string;
}

export interface SaveAsTemplateData {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  includeThreats?: boolean;
}

export interface CreateFromTemplateData {
  projectId: string;
  name: string;
  description?: string;
}

export interface TemplateCategory {
  name: string;
  count: number;
}
