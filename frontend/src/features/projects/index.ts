/**
 * Projects Feature - Public API
 *
 * Project management including creation, listing, and settings.
 */

// Components
export { ProjectList } from "./components/ProjectList";
export { ProjectSettings } from "./components/ProjectSettings";

// Hooks
export { useProjects, useProject } from "./hooks/useProjects";

// Types
export type { ProjectSummary } from "./types";

// Services
export * as projectApi from "./services/api";
