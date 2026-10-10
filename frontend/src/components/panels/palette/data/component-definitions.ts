/**
 * Component Palette Data Definitions
 *
 * All component definitions organized by category.
 * This file contains pure data - no React components.
 */

import {
  User,
  Globe,
  Cog,
  Database,
  Monitor,
  Smartphone,
  AppWindow,
  Webhook,
  Boxes,
  Zap,
  FolderOpen,
  Archive,
  Layers,
  MemoryStick,
  Mail,
  Network,
  Router,
  Globe2,
  Milestone,
  Flame,
  ShieldCheck,
  KeyRound,
  Lock,
  Shield,
  Fingerprint,
  UserCheck,
  Container,
  Ship,
  Server,
  Cpu,
  FileCode,
  Wallet,
  Hexagon,
  Eye,
  CloudCog,
  CircuitBoard,
  Activity,
  Brain,
  Bot,
  Workflow,
  Sparkles,
} from "lucide-react";
import type { PaletteItem } from "../types";

// ============================================================================
// Core Components
// ============================================================================

export const dfdElements: PaletteItem[] = [
  {
    type: "ACTOR",
    label: "Actor",
    Icon: User,
    description: "Human user or role",
    color: "text-blue-500",
  },
  {
    type: "EXTERNAL_ENTITY",
    label: "External Entity",
    Icon: Globe,
    description: "External system",
    color: "text-purple-500",
  },
  {
    type: "PROCESS",
    label: "Process",
    Icon: Cog,
    description: "Processing component",
    color: "text-green-500",
  },
  {
    type: "DATA_STORE",
    label: "Data Store",
    Icon: Database,
    description: "Data storage",
    color: "text-amber-500",
  },
];

export const applicationLayer: PaletteItem[] = [
  {
    type: "WEB_APP",
    label: "Web App",
    Icon: Monitor,
    description: "Web frontend",
    color: "text-blue-500",
  },
  {
    type: "MOBILE_APP",
    label: "Mobile App",
    Icon: Smartphone,
    description: "Mobile application",
    color: "text-cyan-500",
  },
  {
    type: "DESKTOP_APP",
    label: "Desktop App",
    Icon: AppWindow,
    description: "Desktop application",
    color: "text-slate-500",
  },
  {
    type: "API",
    label: "REST/GraphQL API",
    Icon: Webhook,
    description: "API endpoint",
    color: "text-green-500",
  },
  {
    type: "MICROSERVICE",
    label: "Microservice",
    Icon: Boxes,
    description: "Service container",
    color: "text-violet-500",
  },
  {
    type: "SERVERLESS",
    label: "Serverless",
    Icon: Zap,
    description: "Function as a service",
    color: "text-yellow-500",
  },
];

export const dataLayer: PaletteItem[] = [
  {
    type: "DATABASE",
    label: "Database",
    Icon: Database,
    description: "SQL/NoSQL DB",
    color: "text-blue-600",
  },
  {
    type: "FILE_SYSTEM",
    label: "File System",
    Icon: FolderOpen,
    description: "File storage",
    color: "text-amber-600",
  },
  {
    type: "OBJECT_STORAGE",
    label: "Object Storage",
    Icon: Archive,
    description: "Blob/object store",
    color: "text-orange-500",
  },
  {
    type: "DATA_LAKE",
    label: "Data Lake",
    Icon: Layers,
    description: "Data lake/warehouse",
    color: "text-teal-500",
  },
  {
    type: "CACHE",
    label: "Cache",
    Icon: MemoryStick,
    description: "Redis/Memcached",
    color: "text-red-500",
  },
  {
    type: "QUEUE",
    label: "Message Queue",
    Icon: Mail,
    description: "Message broker",
    color: "text-pink-500",
  },
];

export const networking: PaletteItem[] = [
  {
    type: "LOAD_BALANCER",
    label: "Load Balancer",
    Icon: Network,
    description: "Traffic distribution",
    color: "text-indigo-500",
  },
  {
    type: "API_GATEWAY",
    label: "API Gateway",
    Icon: Router,
    description: "API management",
    color: "text-purple-500",
  },
  {
    type: "CDN",
    label: "CDN",
    Icon: Globe2,
    description: "Content delivery",
    color: "text-sky-500",
  },
  {
    type: "DNS",
    label: "DNS",
    Icon: Milestone,
    description: "Domain name service",
    color: "text-emerald-500",
  },
  {
    type: "FIREWALL",
    label: "Firewall",
    Icon: Flame,
    description: "Network firewall",
    color: "text-orange-600",
  },
  {
    type: "VPN",
    label: "VPN",
    Icon: ShieldCheck,
    description: "VPN gateway",
    color: "text-green-600",
  },
];

export const security: PaletteItem[] = [
  {
    type: "IAM",
    label: "IAM",
    Icon: KeyRound,
    description: "Identity & access",
    color: "text-yellow-600",
  },
  {
    type: "SECRETS_MANAGER",
    label: "Secrets Manager",
    Icon: Lock,
    description: "Secret storage",
    color: "text-red-600",
  },
  {
    type: "WAF",
    label: "WAF",
    Icon: Shield,
    description: "Web app firewall",
    color: "text-orange-500",
  },
  {
    type: "ENCRYPTION",
    label: "Encryption",
    Icon: Fingerprint,
    description: "KMS/encryption",
    color: "text-violet-600",
  },
  {
    type: "AUTH_SERVICE",
    label: "Auth Service",
    Icon: UserCheck,
    description: "Authentication",
    color: "text-blue-600",
  },
];

export const infrastructure: PaletteItem[] = [
  {
    type: "CONTAINER",
    label: "Container",
    Icon: Container,
    description: "Docker container",
    color: "text-blue-500",
  },
  {
    type: "KUBERNETES",
    label: "Kubernetes",
    Icon: Ship,
    description: "K8s cluster",
    color: "text-blue-600",
  },
  {
    type: "VM",
    label: "Virtual Machine",
    Icon: Server,
    description: "VM instance",
    color: "text-slate-600",
  },
  {
    type: "SERVER",
    label: "Server",
    Icon: Cpu,
    description: "Physical server",
    color: "text-gray-600",
  },
];

export const blockchain: PaletteItem[] = [
  {
    type: "SMART_CONTRACT",
    label: "Smart Contract",
    Icon: FileCode,
    description: "On-chain logic",
    color: "text-purple-500",
  },
  {
    type: "WALLET",
    label: "Wallet",
    Icon: Wallet,
    description: "Crypto wallet",
    color: "text-amber-500",
  },
  {
    type: "BLOCKCHAIN_NODE",
    label: "Blockchain Node",
    Icon: Hexagon,
    description: "Network node",
    color: "text-indigo-500",
  },
  {
    type: "ORACLE",
    label: "Oracle",
    Icon: Eye,
    description: "Data oracle",
    color: "text-cyan-500",
  },
  {
    type: "IPFS",
    label: "IPFS",
    Icon: CloudCog,
    description: "Decentralized storage",
    color: "text-teal-500",
  },
];

export const aiml: PaletteItem[] = [
  {
    type: "AI_ML_MODEL",
    label: "ML Model",
    Icon: Brain,
    description: "Machine learning model",
    color: "text-violet-500",
  },
  {
    type: "LLM_API",
    label: "LLM API",
    Icon: Sparkles,
    description: "Large language model API",
    color: "text-violet-500",
  },
  {
    type: "TRAINING_PIPELINE",
    label: "Training Pipeline",
    Icon: Workflow,
    description: "Model training pipeline",
    color: "text-violet-500",
  },
  {
    type: "FEATURE_STORE",
    label: "Feature Store",
    Icon: Activity,
    description: "ML feature store",
    color: "text-violet-500",
  },
  {
    type: "VECTOR_DB",
    label: "Vector DB",
    Icon: Layers,
    description: "Embedding vector database",
    color: "text-violet-500",
  },
  {
    type: "EMBEDDING_SERVICE",
    label: "Embedding Service",
    Icon: CircuitBoard,
    description: "Text/image embedding service",
    color: "text-violet-500",
  },
  {
    type: "AI_AGENT",
    label: "AI Agent",
    Icon: Bot,
    description: "Autonomous AI agent",
    color: "text-violet-500",
  },
];

export const other: PaletteItem[] = [
  {
    type: "CUSTOM",
    label: "Custom",
    Icon: Boxes,
    description: "Custom component",
    color: "text-gray-500",
  },
];
