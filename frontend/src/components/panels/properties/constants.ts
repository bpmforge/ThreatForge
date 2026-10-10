/**
 * Properties Panel Constants
 *
 * Option arrays and presets for the properties panel.
 */

import type {
  ComponentType,
  TrustLevel,
  Protocol,
  AuthMethod,
  DataClassification,
  EdgeStyle,
  InterfaceDirection,
  InterfacePosition,
} from "@/types/canvas";
import { categories } from "@/components/panels/palette/data";

/** Preset colors for quick selection */
export const colorPresets = [
  { name: "Blue", bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  { name: "Green", bg: "#dcfce7", border: "#22c55e", text: "#166534" },
  { name: "Red", bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  { name: "Yellow", bg: "#fef9c3", border: "#eab308", text: "#854d0e" },
  { name: "Purple", bg: "#f3e8ff", border: "#a855f7", text: "#6b21a8" },
  { name: "Orange", bg: "#ffedd5", border: "#f97316", text: "#9a3412" },
  { name: "Cyan", bg: "#cffafe", border: "#06b6d4", text: "#155e75" },
  { name: "Pink", bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
];

/** Edge line style options */
export const edgeLineStyles: { value: EdgeStyle; label: string }[] = [
  { value: "bezier", label: "Curved" },
  { value: "straight", label: "Straight" },
  { value: "smoothstep", label: "Rounded Steps" },
  { value: "step", label: "Sharp Steps" },
];

/** Font size options */
export const fontSizes: {
  value: "xs" | "sm" | "base" | "lg";
  label: string;
}[] = [
  { value: "xs", label: "Extra Small" },
  { value: "sm", label: "Small" },
  { value: "base", label: "Medium" },
  { value: "lg", label: "Large" },
];

/**
 * Component type groups sourced from the palette catalog — gives the properties
 * panel dropdown access to all 207 types (generic + AWS/Azure/GCP) organized by
 * vendor/category. Single source of truth: edit the palette, the dropdown follows.
 */
export interface ComponentTypeGroup {
  label: string;
  options: { value: ComponentType; label: string }[];
}

export const componentTypeGroups: ComponentTypeGroup[] = categories.map(
  (cat) => ({
    label: cat.title,
    options: cat.items.map((item) => ({
      value: item.type as ComponentType,
      label: item.label,
    })),
  }),
);

/** Flat list — kept for legacy consumers that don't group (e.g. validation). */
export const componentTypes: { value: ComponentType; label: string }[] =
  componentTypeGroups.flatMap((g) => g.options);

export const trustLevels: { value: TrustLevel; label: string }[] = [
  { value: "PUBLIC", label: "Public" },
  { value: "INTERNAL", label: "Internal" },
  { value: "CONFIDENTIAL", label: "Confidential" },
  { value: "RESTRICTED", label: "Restricted" },
];

export const protocols: { value: Protocol; label: string }[] = [
  { value: "HTTP", label: "HTTP" },
  { value: "HTTPS", label: "HTTPS" },
  { value: "gRPC", label: "gRPC" },
  { value: "WebSocket", label: "WebSocket" },
  { value: "TCP", label: "TCP" },
  { value: "UDP", label: "UDP" },
  { value: "AMQP", label: "AMQP" },
  { value: "MQTT", label: "MQTT" },
  { value: "Kafka", label: "Kafka" },
  { value: "PostgreSQL", label: "PostgreSQL" },
  { value: "MySQL", label: "MySQL" },
  { value: "MongoDB", label: "MongoDB" },
  { value: "Redis", label: "Redis" },
  { value: "SSH", label: "SSH" },
  { value: "SFTP", label: "SFTP" },
  { value: "Custom", label: "Custom" },
];

export const interfaceDirections: {
  value: InterfaceDirection;
  label: string;
}[] = [
  { value: "ingress", label: "Ingress (Input)" },
  { value: "egress", label: "Egress (Output)" },
  { value: "bidirectional", label: "Bidirectional" },
];

export const interfacePositions: { value: InterfacePosition; label: string }[] =
  [
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
    { value: "top", label: "Top" },
    { value: "bottom", label: "Bottom" },
  ];

export const authMethods: { value: AuthMethod; label: string }[] = [
  { value: "None", label: "None" },
  { value: "API_KEY", label: "API Key" },
  { value: "JWT", label: "JWT" },
  { value: "OAuth2", label: "OAuth 2.0" },
  { value: "mTLS", label: "mTLS" },
  { value: "Basic", label: "Basic Auth" },
  { value: "SAML", label: "SAML" },
  { value: "Custom", label: "Custom" },
];

export const dataClassifications: {
  value: DataClassification;
  label: string;
}[] = [
  { value: "PII", label: "PII (Personal)" },
  { value: "PHI", label: "PHI (Health)" },
  { value: "Financial", label: "Financial" },
  { value: "Credentials", label: "Credentials" },
  { value: "Internal", label: "Internal" },
  { value: "Public", label: "Public" },
];
