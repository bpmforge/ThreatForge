/**
 * Compliance Frameworks Types
 */

interface CustomControl {
  id: string;
  controlId: string;
  name: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  strideCategories: string[];
  keywords: string[];
  mappedControls?: Record<string, string[]>;
}

interface CustomCategory {
  id: string;
  name: string;
  controls: CustomControl[];
}

export interface CustomFrameworkData {
  id: string;
  name: string;
  shortName: string;
  description: string;
  version: string;
  color: string;
  isPublic: boolean;
  categories: CustomCategory[];
  inheritedControls: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface NewFrameworkForm {
  name: string;
  shortName: string;
  description: string;
  version: string;
  color: string;
  isPublic: boolean;
  inheritedFrameworks: string[];
}

export const COLOR_OPTIONS = [
  { value: "bg-indigo-500", label: "Indigo" },
  { value: "bg-blue-500", label: "Blue" },
  { value: "bg-green-500", label: "Green" },
  { value: "bg-purple-500", label: "Purple" },
  { value: "bg-orange-500", label: "Orange" },
  { value: "bg-red-500", label: "Red" },
  { value: "bg-teal-500", label: "Teal" },
] as const;

export const DEFAULT_NEW_FRAMEWORK: NewFrameworkForm = {
  name: "",
  shortName: "",
  description: "",
  version: "1.0",
  color: "bg-indigo-500",
  isPublic: false,
  inheritedFrameworks: [],
};
