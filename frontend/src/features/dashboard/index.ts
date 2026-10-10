/**
 * Dashboard Feature - Public API
 *
 * Dashboard for managing threat models, viewing stats, and quick actions.
 */

// Components
export { StatsCard } from "./components/StatsCard";
export { RecentModels } from "./components/RecentModels";
export { QuickActions } from "./components/QuickActions";
export { ActivityFeed } from "./components/ActivityFeed";
export { CreateModelDialog } from "./components/CreateModelDialog";
export { CreateFromGithubDialog } from "./components/CreateFromGithubDialog";
export { FocusedModelStats } from "./components/FocusedModelStats";
export { EmptyDashboard } from "./components/EmptyDashboard";
export { RiskScoreWidget } from "./components/RiskScoreWidget";
export { ProjectsAtRisk } from "./components/ProjectsAtRisk";

// Hooks

export {
  useThreatModels,
  useThreatModel,
  useCreateThreatModel,
  useDashboardStats,
  useImportThreatModel,
  useUpdateModelStatus,
  useUpdateModelTags,
  useProjectsAtRisk,
} from "./hooks/useDashboard";

// Types
export type { ModelStatus } from "./types";

// Services
export * as dashboardApi from "./services/api";
