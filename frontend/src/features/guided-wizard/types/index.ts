import type { ComponentType } from "@/types/canvas";

export type SystemType =
  | "web-application"
  | "mobile-app"
  | "api-microservices"
  | "desktop-application"
  | "iot-system"
  | "data-pipeline"
  | "saas-platform";

type WizardDataClassification =
  | "credentials"
  | "pii"
  | "pci"
  | "phi"
  | "internal"
  | "public";

type DeploymentType =
  | "cloud-aws"
  | "cloud-gcp"
  | "cloud-azure"
  | "on-premises"
  | "hybrid"
  | "edge";

export interface WizardAnswers {
  systemType?: SystemType;
  systemName?: string;
  systemDescription?: string;
  dataTypes?: WizardDataClassification[];
  deployment?: DeploymentType;
  hasAuthentication?: boolean;
  hasExternalApis?: boolean;
  hasDatabaseStorage?: boolean;
  hasFileStorage?: boolean;
  hasMessageQueues?: boolean;
}

export interface SuggestedComponent {
  id: string;
  name: string;
  type: ComponentType;
  description: string;
  selected: boolean;
}

export interface WizardState {
  step: number;
  answers: WizardAnswers;
  suggestedComponents: SuggestedComponent[];
  isGenerating: boolean;
}
