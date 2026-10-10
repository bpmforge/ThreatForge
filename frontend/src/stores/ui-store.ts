/**
 * UI Store for global UI state management.
 *
 * Manages panel visibility, active panels, and UI-level interactions.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ComponentType } from "@/types/canvas";

export type RightPanelType =
  | "properties"
  | "threats"
  | "compliance"
  | "review"
  | "ai"
  | "chat"
  | "score"
  | "checklist"
  | "suggest"
  | "similar"
  | "docs"
  | "expert"
  | "refine"
  | "requirements"
  | "gaps"
  | "coverage"
  | "chains";

interface UIState {
  /** Currently active right panel */
  activeRightPanel: RightPanelType;
  /** Component ID to add threat to (set by context menu) */
  addThreatToComponentId: string | null;
  /** Whether to open AI suggestions panel */
  openAISuggestions: boolean;
  /** Momentary signal to open the Guided Wizard (consumed by the model page) */
  guidedWizardOpen: boolean;
  /** Momentary signal to trigger the document import flow (consumed by the model page) */
  importRequested: boolean;
  /** Whether the opt-in product tour dialog is open (app-wide) */
  tourOpen: boolean;
  /** Whether left panel is collapsed */
  leftPanelCollapsed: boolean;
  /** Whether right panel is collapsed */
  rightPanelCollapsed: boolean;
  /** Whether threat catalog dialog is open */
  threatCatalogOpen: boolean;
  /** Component ID for threat catalog context */
  threatCatalogComponentId: string | null;
  /** Whether format painter mode is active */
  isFormatPainting: boolean;
  /** Component type selected for tap-to-place (mobile/touch mode) */
  pendingPaletteType: ComponentType | null;
}

interface UIActions {
  /** Set the active right panel */
  setActiveRightPanel: (panel: RightPanelType) => void;
  /** Request to add a threat to a specific component */
  requestAddThreat: (componentId: string) => void;
  /** Clear the add threat request */
  clearAddThreatRequest: () => void;
  /** Request AI threat suggestions */
  requestAISuggestions: () => void;
  /** Clear AI suggestions request */
  clearAISuggestionsRequest: () => void;
  /** Request the Guided Wizard to open (e.g. from the canvas empty state) */
  openGuidedWizard: () => void;
  /** Clear the Guided Wizard open signal after it is consumed */
  closeGuidedWizard: () => void;
  /** Request the document import flow (e.g. from the canvas empty state) */
  requestImport: () => void;
  /** Clear the import request after it is consumed */
  clearImportRequest: () => void;
  /** Open the opt-in product tour */
  openTour: () => void;
  /** Close the opt-in product tour */
  closeTour: () => void;
  /** Toggle left panel collapsed state */
  toggleLeftPanel: () => void;
  /** Toggle right panel collapsed state */
  toggleRightPanel: () => void;
  /** Set left panel collapsed state */
  setLeftPanelCollapsed: (collapsed: boolean) => void;
  /** Set right panel collapsed state */
  setRightPanelCollapsed: (collapsed: boolean) => void;
  /** Open threat catalog dialog */
  openThreatCatalog: (componentId?: string | null) => void;
  /** Close threat catalog dialog */
  closeThreatCatalog: () => void;
  /** Set format painter mode */
  setIsFormatPainting: (val: boolean) => void;
  /** Set a pending palette type for tap-to-place; null clears it */
  setPendingPaletteType: (type: ComponentType | null) => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  devtools(
    (set) => ({
      // Initial state
      activeRightPanel: "properties",
      addThreatToComponentId: null,
      openAISuggestions: false,
      guidedWizardOpen: false,
      importRequested: false,
      tourOpen: false,
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      threatCatalogOpen: false,
      threatCatalogComponentId: null,
      isFormatPainting: false,
      pendingPaletteType: null,

      setActiveRightPanel: (panel) =>
        set({ activeRightPanel: panel }, false, "setActiveRightPanel"),

      requestAddThreat: (componentId) =>
        set(
          { addThreatToComponentId: componentId, activeRightPanel: "threats" },
          false,
          "requestAddThreat",
        ),

      clearAddThreatRequest: () =>
        set({ addThreatToComponentId: null }, false, "clearAddThreatRequest"),

      requestAISuggestions: () =>
        set(
          { openAISuggestions: true, activeRightPanel: "ai" },
          false,
          "requestAISuggestions",
        ),

      clearAISuggestionsRequest: () =>
        set({ openAISuggestions: false }, false, "clearAISuggestionsRequest"),

      openGuidedWizard: () =>
        set({ guidedWizardOpen: true }, false, "openGuidedWizard"),

      closeGuidedWizard: () =>
        set({ guidedWizardOpen: false }, false, "closeGuidedWizard"),

      requestImport: () =>
        set({ importRequested: true }, false, "requestImport"),

      clearImportRequest: () =>
        set({ importRequested: false }, false, "clearImportRequest"),

      openTour: () => set({ tourOpen: true }, false, "openTour"),

      closeTour: () => set({ tourOpen: false }, false, "closeTour"),

      toggleLeftPanel: () =>
        set(
          (state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed }),
          false,
          "toggleLeftPanel",
        ),

      toggleRightPanel: () =>
        set(
          (state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed }),
          false,
          "toggleRightPanel",
        ),

      setLeftPanelCollapsed: (collapsed) =>
        set({ leftPanelCollapsed: collapsed }, false, "setLeftPanelCollapsed"),

      setRightPanelCollapsed: (collapsed) =>
        set(
          { rightPanelCollapsed: collapsed },
          false,
          "setRightPanelCollapsed",
        ),

      openThreatCatalog: (componentId = null) =>
        set(
          { threatCatalogOpen: true, threatCatalogComponentId: componentId },
          false,
          "openThreatCatalog",
        ),

      closeThreatCatalog: () =>
        set(
          { threatCatalogOpen: false, threatCatalogComponentId: null },
          false,
          "closeThreatCatalog",
        ),

      setIsFormatPainting: (val) =>
        set({ isFormatPainting: val }, false, "setIsFormatPainting"),

      setPendingPaletteType: (type) =>
        set({ pendingPaletteType: type }, false, "setPendingPaletteType"),
    }),
    { name: "ui-store" },
  ),
);
