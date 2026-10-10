import type { DataType, ExternalEntityType, FlowVolume } from "../types";

export const DATA_TYPE_OPTIONS: { value: DataType; label: string }[] = [
  { value: "PII", label: "PII" },
  { value: "PHI", label: "PHI" },
  { value: "FINANCIAL", label: "Financial" },
  { value: "CREDENTIALS", label: "Credentials" },
  { value: "INTERNAL", label: "Internal" },
  { value: "PUBLIC", label: "Public" },
];

export const ENTITY_TYPE_OPTIONS: {
  value: ExternalEntityType;
  label: string;
}[] = [
  { value: "USER", label: "User" },
  { value: "SYSTEM", label: "System" },
  { value: "SERVICE", label: "Service" },
];

export const VOLUME_OPTIONS: { value: FlowVolume; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];
