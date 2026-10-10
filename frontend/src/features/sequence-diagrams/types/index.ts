/**
 * Sequence Diagrams Feature - Types
 */

export type MessageType =
  | "SYNC"
  | "ASYNC"
  | "RETURN"
  | "SELF"
  | "CREATE"
  | "DESTROY";

type Protocol =
  | "HTTP"
  | "HTTPS"
  | "GRPC"
  | "WEBSOCKET"
  | "TCP"
  | "UDP"
  | "AMQP"
  | "MQTT"
  | "CUSTOM";

type AuthMethod =
  | "NONE"
  | "API_KEY"
  | "JWT"
  | "OAUTH2"
  | "MTLS"
  | "BASIC"
  | "SAML"
  | "CUSTOM";

export interface SequenceParticipant {
  id: string;
  label: string;
  order: number;
  componentId?: string | null;
  sequenceDiagramId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceMessage {
  id: string;
  label: string;
  order: number;
  messageType: MessageType;
  protocol?: Protocol | null;
  authentication?: AuthMethod | null;
  isReturn: boolean;
  notes?: string | null;
  sequenceDiagramId: string;
  fromId: string;
  toId: string;
  fromParticipant?: SequenceParticipant;
  toParticipant?: SequenceParticipant;
  threats: string; // JSON array of threat IDs
  createdAt: string;
  updatedAt: string;
}

export interface SequenceDiagram {
  id: string;
  name: string;
  description?: string | null;
  order: number;
  threatModelId: string;
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
  createdAt: string;
  updatedAt: string;
  createdById: string;
}

export interface CreateSequenceDiagramRequest {
  name: string;
  description?: string;
}

export interface UpdateSequenceDiagramRequest {
  name?: string;
  description?: string;
  order?: number;
}

export interface CreateParticipantRequest {
  label: string;
  order: number;
  componentId?: string;
}

export interface UpdateParticipantRequest {
  label?: string;
  order?: number;
  componentId?: string | null;
}

export interface CreateMessageRequest {
  label: string;
  order: number;
  fromId: string;
  toId: string;
  messageType?: MessageType;
  protocol?: Protocol;
  authentication?: AuthMethod;
  isReturn?: boolean;
  notes?: string;
}

export interface UpdateMessageRequest {
  label?: string;
  order?: number;
  fromId?: string;
  toId?: string;
  messageType?: MessageType;
  protocol?: Protocol | null;
  authentication?: AuthMethod | null;
  isReturn?: boolean;
  notes?: string | null;
}

// Diagram tab types
export type DiagramType = "architecture" | "sequence" | "dfd";

export interface DiagramTab {
  id: string;
  type: DiagramType;
  label: string;
  sequenceDiagramId?: string; // Only for sequence tabs
  dfdId?: string; // Only for DFD tabs
  closeable: boolean;
}

// Architecture component type for linking
export interface ArchitectureComponent {
  id: string;
  name: string;
  type: string;
  description?: string | null;
}
