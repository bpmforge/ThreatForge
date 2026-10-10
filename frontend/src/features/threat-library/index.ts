/**
 * Threat Library Feature - Public API
 *
 * Provides pre-defined STRIDE threats that can be added to components,
 * plus API-based threat library management.
 */

// Components
export { ThreatLibraryDialog } from "./components/ThreatLibraryDialog";
export { LibraryManagerDialog } from "./components/LibraryManagerDialog";

// Hooks - Static library (local data)

// Hooks - API-based library management
export {
  useThreatLibraries,
  useCreateThreatLibrary,
  useCreateThreatTemplate,
} from "./hooks/useThreatLibraryApi";

// Services
export * as threatLibraryApi from "./services/api";

// Data
export { allThreats, threatsBySource, builtInStats } from "./data";

// Types - Static library
export type { LibraryThreat } from "./types";

// Types - API-based library management

// Constants
export { STRIDE_SHORT_NAMES, SEVERITY_COLORS } from "./constants";
