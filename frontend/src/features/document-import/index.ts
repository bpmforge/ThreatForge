/**
 * Document Import Feature
 *
 * Provides document import, parsing, and architecture extraction capabilities.
 */

// Components
export { DocumentImportDialog } from "./components/DocumentImportDialog";

// Hooks

// Services
export { extractArchitecture } from "./services/architecture-extractor";
export { generateModel } from "./services/model-generator";
export {
  buildMergePlan,
  applyMergePlan,
  canvasHasComponents,
  summarizeExistingComponents,
} from "./services/merge-engine";

// Types
export type { ImportedDocument, GeneratedNode, GeneratedEdge } from "./types";
