/**
 * Canvas type definitions for React Flow threat modeling.
 */
import type { ComponentType } from "./canvas/component-type";

export type { ComponentType };

/** STRIDE threat categories */
export type StrideCategory =
  | "SPOOFING"
  | "TAMPERING"
  | "REPUDIATION"
  | "INFORMATION_DISCLOSURE"
  | "DENIAL_OF_SERVICE"
  | "ELEVATION_OF_PRIVILEGE";

/** Trust levels for data classification */
export type TrustLevel = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";

/** Severity levels for threats */
export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Edge/line style options */
export type EdgeStyle = "bezier" | "straight" | "step" | "smoothstep";

/** Component styling options */
export interface ComponentStyle {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  fontSize?: "xs" | "sm" | "base" | "lg";
  strokeWidth?: number;
  /** Rotation in degrees (0 = no rotation). Applied to node content only; handles stay fixed. */
  rotation?: number;
}

/** Component node data */
export interface ComponentNodeData extends Record<string, unknown> {
  label: string;
  /**
   * Optional rich label (Markdown subset: **bold**, *italic*, "- " / "1. " lists).
   * `label` is always kept as the plain-text fallback for old clients/exports.
   */
  richLabel?: string;
  type: ComponentType;
  description?: string;
  trustLevel: TrustLevel;
  locked?: boolean;
  status?: "draft" | "in-review" | "approved" | "deprecated" | null;
  technologies?: string[];
  threats?: ThreatSummary[];
  style?: ComponentStyle;
  /**
   * Dynamic interfaces for this component.
   * If undefined/empty, falls back to default left/right handles.
   */
  interfaces?: ComponentInterface[];
  /** Custom icon as a base64 data URL (PNG/JPEG/SVG/WebP). Overrides the default Lucide icon. */
  customIcon?: string;
  /** Highlighted by find-in-diagram search */
  highlighted?: boolean;
  /** Attack chain highlight role for the selected chain */
  chainHighlight?: "entry" | "target" | "intermediate";
  /** Security context for context-aware threat generation */
  securityContext?: {
    dataClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
    dataTypes: string[];
    accessPattern:
      | "PUBLIC_INTERNET"
      | "AUTHENTICATED_USERS"
      | "INTERNAL_ONLY"
      | "PARTNER_API";
    complianceFrameworks: string[];
    existingControls: string[];
    technologyVersion?: string;
  };
}

/** Boundary node data (group node) */
export interface BoundaryNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  trustLevel: TrustLevel;
  color?: string;
  opacity?: number; // 0-100, default 50
  locked?: boolean;
  collapsed?: boolean;
}

/** Protocol options for data flows */
export type Protocol =
  | "HTTP"
  | "HTTPS"
  | "gRPC"
  | "WebSocket"
  | "TCP"
  | "UDP"
  | "AMQP"
  | "MQTT"
  | "Kafka"
  | "PostgreSQL"
  | "MySQL"
  | "MongoDB"
  | "Redis"
  | "SSH"
  | "SFTP"
  | "Custom";

/** Handle/interface position on component */
export type InterfacePosition = "left" | "right" | "top" | "bottom";

/** Direction of data flow through an interface */
export type InterfaceDirection = "ingress" | "egress" | "bidirectional";

/**
 * Component Interface - represents a single connection point on a component.
 * Each interface has its own port, protocol, and security properties.
 * This enables accurate attack surface mapping for threat modeling.
 */
export interface ComponentInterface {
  /** Unique identifier (used as React Flow handle ID) */
  id: string;

  /** Human-readable name (e.g., "User Portal", "Admin API") */
  name: string;

  /** Direction of data flow */
  direction: InterfaceDirection;

  /** Which side of the node this handle appears on */
  position: InterfacePosition;

  /** Port number (e.g., 443, 8443, 5432) */
  port?: number;

  /** Protocol used on this interface */
  protocol: Protocol;

  /** Authentication method required */
  authentication: AuthMethod;

  /** Whether connection is encrypted */
  encrypted: boolean;

  /** Types of data that flow through this interface */
  dataClassifications?: DataClassification[];

  /** Whether this interface is exposed externally (outside trust boundary) */
  externallyAccessible?: boolean;
}

/** Authentication method options */
export type AuthMethod =
  | "None"
  | "API_KEY"
  | "JWT"
  | "OAuth2"
  | "mTLS"
  | "Basic"
  | "SAML"
  | "Custom";

/** Data classification types */
export type DataClassification =
  | "PII"
  | "PHI"
  | "Financial"
  | "Credentials"
  | "Internal"
  | "Public";

/** Edge styling options */
export interface EdgeStyleOptions {
  strokeColor?: string;
  strokeWidth?: number;
  lineStyle?: EdgeStyle;
  animated?: boolean;
}

/** Endpoint arrowhead style */
export type EndpointStyle =
  | "none"
  | "arrow"
  | "arrow-open"
  | "diamond"
  | "circle"
  | "tee"
  | "cross";

/** Connection/edge data */
export interface ConnectionData extends Record<string, unknown> {
  label?: string;
  protocol?: Protocol;
  authentication?: AuthMethod;
  dataClassifications?: DataClassification[];
  encrypted?: boolean;
  authenticated?: boolean;
  crossesBoundary?: boolean;
  sourceBoundaryId?: string;
  targetBoundaryId?: string;
  description?: string;
  threats?: ThreatSummary[];
  style?: EdgeStyleOptions;
  /** The source interface ID this edge connects from */
  sourceInterfaceId?: string;
  /** The target interface ID this edge connects to */
  targetInterfaceId?: string;
  /** Waypoints with manual-anchor flag. `manual: true` = user-dragged, renders filled pill. */
  waypoints?: Array<{ x: number; y: number; manual?: boolean }> | null;
  /** Label position along path (0..1). Default 0.5 (midpoint). */
  labelPosition?: number;
  /** Label perpendicular offset preset. */
  labelOffset?: "above" | "center" | "below";
  /** Label display size. */
  labelSize?: "xs" | "sm" | "md" | "lg";
  /** Explicit stroke pattern (overrides encrypted-auto-dashed). */
  strokePattern?: "solid" | "dashed" | "dotted";
  /** Corner radius in px for step/smoothstep lines. Default 0. */
  cornerRadius?: number;
  /** Endpoint arrowhead styles. */
  endpoint?: {
    start?: EndpointStyle;
    end?: EndpointStyle;
  };
  /** Stroke variant. */
  lineVariant?: "single" | "double";
  /** Small label near the SOURCE end of the line (cardinality, port, "request"). */
  startLabel?: string;
  /** Small label near the TARGET end of the line. */
  endLabel?: string;
}

/** Brief threat info for display on nodes/edges */
export interface ThreatSummary {
  id: string;
  title: string;
  category: StrideCategory;
  severity: Severity;
  mitigated: boolean;
}

/** Legend node data */
export interface LegendNodeData extends Record<string, unknown> {
  label: string;
}

/** Swimlane node data */
export interface SwimlaneNodeData extends Record<string, unknown> {
  label: string;
  lanes: Array<{ id: string; name: string; color?: string }>;
  locked?: boolean;
}
