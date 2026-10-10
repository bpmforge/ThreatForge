/**
 * Component Templates Feature - Public API
 *
 * Provides reusable component configurations for teams,
 * including custom icons, colors, default properties, and suggested threats.
 */

// Components
export { ComponentTemplateManagerDialog } from "./components/ComponentTemplateManagerDialog";
export { ComponentTemplateBrowser } from "./components/ComponentTemplateBrowser";

// Types
export * from "./types";

// Hooks
export { useComponentTemplateLibraries } from "./hooks/useComponentTemplates";

// Services
export * as componentTemplatesApi from "./services/api";
