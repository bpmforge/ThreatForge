export type ExperienceLevel = "beginner" | "intermediate" | "expert";

export type UserRole =
  | "developer"
  | "security-engineer"
  | "architect"
  | "manager"
  | "other";

export const EXPERIENCE_OPTIONS = [
  {
    value: "beginner" as ExperienceLevel,
    label: "I'm new to this",
    description: "We'll provide extra guidance",
  },
  {
    value: "intermediate" as ExperienceLevel,
    label: "I've done a few threat models",
    description: "Standard experience",
  },
  {
    value: "expert" as ExperienceLevel,
    label: "I'm an experienced practitioner",
    description: "Streamlined workflow",
  },
] as const;

export const ROLE_OPTIONS = [
  { value: "developer" as UserRole, label: "Developer" },
  { value: "security-engineer" as UserRole, label: "Security Engineer" },
  { value: "architect" as UserRole, label: "Architect" },
  { value: "manager" as UserRole, label: "Manager" },
  { value: "other" as UserRole, label: "Other" },
] as const;
