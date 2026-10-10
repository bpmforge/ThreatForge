/**
 * Collaboration Feature
 *
 * Real-time collaboration using Yjs for threat model editing.
 * Supports canvas (nodes/edges), threats, and mitigations sync.
 */

// Types
export type { Collaborator } from "./types";

// Hooks
export { useCollaborativeCanvas } from "./hooks/useCollaborativeCanvas";

// Components
export { CollaboratorCursors } from "./components/CollaboratorCursors";
export { SelectionHighlights } from "./components/SelectionHighlights";
