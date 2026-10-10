/**
 * Organization Context Store
 *
 * Manages the currently selected organization context.
 * Persists selection to localStorage for cross-session retention.
 */
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface OrgState {
  /** Currently selected organization ID */
  currentOrgId: string | null;
  /** Whether the org context is being initialized */
  isInitializing: boolean;
}

interface OrgActions {
  /** Set the current organization */
  setCurrentOrg: (orgId: string | null) => void;
  /** Initialize org context (called on app load) */
  initializeOrg: (defaultOrgId: string | null) => void;
  /** Clear the current organization */
  clearCurrentOrg: () => void;
}

type OrgStore = OrgState & OrgActions;

export const useOrgStore = create<OrgStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentOrgId: null,
        isInitializing: true,

        setCurrentOrg: (orgId) =>
          set(
            { currentOrgId: orgId, isInitializing: false },
            false,
            "setCurrentOrg",
          ),

        initializeOrg: (defaultOrgId) => {
          const state = get();
          // Only initialize if not already set
          if (state.isInitializing) {
            set(
              {
                currentOrgId: state.currentOrgId || defaultOrgId,
                isInitializing: false,
              },
              false,
              "initializeOrg",
            );
          }
        },

        clearCurrentOrg: () =>
          set({ currentOrgId: null }, false, "clearCurrentOrg"),
      }),
      {
        name: "org-context",
        // Only persist the org ID, not initialization state
        partialize: (state) => ({ currentOrgId: state.currentOrgId }),
      },
    ),
    { name: "org-store" },
  ),
);

/**
 * Hook to get current org ID with automatic initialization.
 * Falls back to first available org if none selected.
 */
export function useCurrentOrgId() {
  return useOrgStore((state) => state.currentOrgId);
}
