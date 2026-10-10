import {
  MessageSquare,
  Upload,
  LayoutTemplate,
  Github,
  PenTool,
  FileCode,
  FileType,
  Import,
  Container,
  Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type CreationMethod =
  | "choose"
  | "describe"
  | "import"
  | "import-terraform"
  | "import-kubernetes"
  | "import-docker-compose"
  | "import-tool"
  | "import-yaml"
  | "template"
  | "github"
  | "blank";

export interface MethodDef {
  id: CreationMethod;
  icon: LucideIcon;
  title: string;
  description: string;
  badge: string | null;
  badgeColor: string;
}

export const METHODS: MethodDef[] = [
  {
    id: "describe",
    icon: MessageSquare,
    title: "Describe Your System",
    description:
      "Tell us about your system in plain text — AI generates the threat model",
    badge: "Fastest",
    badgeColor: "bg-green-500/10 text-green-600",
  },
  {
    id: "import",
    icon: Upload,
    title: "Import Document",
    description: "Upload architecture doc (PDF, DOCX, Markdown) or paste a URL",
    badge: "Popular",
    badgeColor: "bg-blue-500/10 text-blue-600",
  },
  {
    id: "template",
    icon: LayoutTemplate,
    title: "Start from Template",
    description:
      "Choose a pre-built architecture (Web App, Microservices, Serverless, etc.)",
    badge: null,
    badgeColor: "",
  },
  {
    id: "github",
    icon: Github,
    title: "Analyze GitHub Repo",
    description:
      "Connect a repository — AI reads the code and generates a threat model",
    badge: "New",
    badgeColor: "bg-purple-500/10 text-purple-600",
  },
  {
    id: "import-terraform",
    icon: FileCode,
    title: "Import Terraform",
    description: "Paste .tf file contents — auto-maps AWS/GCP/Azure resources",
    badge: "New",
    badgeColor: "bg-purple-500/10 text-purple-600",
  },
  {
    id: "import-kubernetes",
    icon: Container,
    title: "Import Kubernetes",
    description: "Paste K8s manifests — maps deployments, services, ingress",
    badge: "New",
    badgeColor: "bg-purple-500/10 text-purple-600",
  },
  {
    id: "import-docker-compose",
    icon: Layers,
    title: "Import Docker Compose",
    description: "Paste docker-compose.yml — maps services, networks, volumes",
    badge: "New",
    badgeColor: "bg-purple-500/10 text-purple-600",
  },
  {
    id: "import-tool",
    icon: Import,
    title: "Import from Tool",
    description:
      "Import from Microsoft TMT (.tm7), OWASP Threat Dragon, or Threagile",
    badge: null,
    badgeColor: "",
  },
  {
    id: "import-yaml",
    icon: FileType,
    title: "Import YAML",
    description: "Import a previously exported ThreatForge YAML threat model",
    badge: null,
    badgeColor: "",
  },
  {
    id: "blank",
    icon: PenTool,
    title: "Blank Canvas",
    description: "Start from scratch with a drag-and-drop canvas",
    badge: null,
    badgeColor: "",
  },
];

export const IMPORT_ENDPOINTS: Partial<Record<CreationMethod, string>> = {
  "import-terraform": "/api/threat-models/import/terraform",
  "import-kubernetes": "/api/threat-models/import/kubernetes",
  "import-docker-compose": "/api/threat-models/import/docker-compose",
  "import-tool": "/api/threat-models/import/tool",
  "import-yaml": "/api/threat-models/import/yaml",
};
