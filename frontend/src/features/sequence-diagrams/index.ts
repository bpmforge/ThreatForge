/**
 * Sequence Diagrams Feature Module
 *
 * Provides sequence diagram editing capabilities linked to architecture components.
 */

// Components
export { DiagramTabs } from "./components/DiagramTabs";
export { SequenceCanvas } from "./components/SequenceCanvas";

// Hooks
export { useSequenceDiagrams } from "./hooks/useSequenceDiagrams";

// Types
export type {
  SequenceMessage as SequenceMessageType,
  SequenceDiagram,
} from "./types";
