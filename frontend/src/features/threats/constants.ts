/**
 * Threats feature constants.
 */
import type {
  StrideCategoryOption,
  SeverityOption,
  StatusOption,
  MitigationStatusOption,
  PriorityOption,
  MitigationStrategyOption,
} from "./types";

export const STRIDE_CATEGORIES: StrideCategoryOption[] = [
  {
    value: "SPOOFING",
    label: "Spoofing",
    short: "S",
    description: "Impersonating something or someone",
  },
  {
    value: "TAMPERING",
    label: "Tampering",
    short: "T",
    description: "Modifying data or code",
  },
  {
    value: "REPUDIATION",
    label: "Repudiation",
    short: "R",
    description: "Claiming to not have performed an action",
  },
  {
    value: "INFORMATION_DISCLOSURE",
    label: "Info Disclosure",
    short: "I",
    description: "Exposing data to unauthorized users",
  },
  {
    value: "DENIAL_OF_SERVICE",
    label: "Denial of Service",
    short: "D",
    description: "Denying or degrading service",
  },
  {
    value: "ELEVATION_OF_PRIVILEGE",
    label: "Elevation of Privilege",
    short: "E",
    description: "Gaining unauthorized capabilities",
  },
];

export const SEVERITY_OPTIONS: SeverityOption[] = [
  { value: "CRITICAL", label: "Critical", color: "bg-red-600" },
  { value: "HIGH", label: "High", color: "bg-orange-600" },
  { value: "MEDIUM", label: "Medium", color: "bg-yellow-600" },
  { value: "LOW", label: "Low", color: "bg-blue-500" },
];

export const STATUS_OPTIONS: StatusOption[] = [
  { value: "OPEN", label: "Open" },
  { value: "MITIGATED", label: "Mitigated" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "NOT_APPLICABLE", label: "N/A" },
];

export const MITIGATION_STATUS_OPTIONS: MitigationStatusOption[] = [
  {
    value: "NOT_IMPLEMENTED",
    label: "Not Implemented",
    color: "text-muted-foreground",
  },
  { value: "IMPLEMENTED", label: "Implemented", color: "text-green-500" },
];

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

export const MITIGATION_STRATEGY_OPTIONS: MitigationStrategyOption[] = [
  {
    value: "PREVENTION",
    label: "Prevention",
    description: "Prevent the threat from occurring",
  },
  {
    value: "DETECTION",
    label: "Detection",
    description: "Detect when the threat occurs",
  },
  {
    value: "RESPONSE",
    label: "Response",
    description: "Respond to the threat when detected",
  },
  {
    value: "RECOVERY",
    label: "Recovery",
    description: "Recover from the threat impact",
  },
  {
    value: "DETERRENCE",
    label: "Deterrence",
    description: "Discourage the threat actor",
  },
];

/** Predefined threat categories based on common security domains */
export const DEFAULT_THREAT_CATEGORIES = [
  "Authentication",
  "Authorization",
  "Session Management",
  "Input Validation",
  "Cryptography",
  "Data Protection",
  "API Security",
  "Network Security",
  "Infrastructure",
  "Logging & Monitoring",
  "Configuration",
  "Third-Party",
  "Business Logic",
  "Compliance",
] as const;
