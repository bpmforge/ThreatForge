/**
 * Diagram store for managing diagram tabs.
 *
 * Handles switching between architecture and sequence diagrams.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  DiagramTab,
  DiagramType,
} from "@/features/sequence-diagrams/types";

interface DiagramState {
  /** Currently active tab ID */
  activeTabId: string;
  /** All diagram tabs */
  tabs: DiagramTab[];
}

interface DiagramActions {
  /** Set the active tab */
  setActiveTab: (tabId: string) => void;
  /** Add a new sequence diagram tab */
  addSequenceTab: (
    id: string,
    label: string,
    sequenceDiagramId: string,
  ) => void;
  /** Add a new DFD tab */
  addDfdTab: (id: string, label: string, dfdId: string) => void;
  /** Remove a tab */
  removeTab: (tabId: string) => void;
  /** Rename a tab */
  renameTab: (tabId: string, label: string) => void;
  /** Initialize tabs from sequence diagrams and DFDs */
  initializeTabs: (
    sequenceDiagrams: Array<{ id: string; name: string }>,
    dfds?: Array<{ id: string; name: string }>,
  ) => void;
  /** Reset to default state */
  reset: () => void;
}

type DiagramStore = DiagramState & DiagramActions;

const ARCHITECTURE_TAB: DiagramTab = {
  id: "architecture",
  type: "architecture",
  label: "Architecture",
  closeable: false,
};

const initialState: DiagramState = {
  activeTabId: "architecture",
  tabs: [ARCHITECTURE_TAB],
};

export const useDiagramStore = create<DiagramStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setActiveTab: (tabId) => {
        set({ activeTabId: tabId }, false, "setActiveTab");
      },

      addSequenceTab: (id, label, sequenceDiagramId) => {
        const newTab: DiagramTab = {
          id,
          type: "sequence",
          label,
          sequenceDiagramId,
          closeable: true,
        };

        set(
          (state) => ({
            tabs: [...state.tabs, newTab],
            activeTabId: id,
          }),
          false,
          "addSequenceTab",
        );
      },

      addDfdTab: (id, label, dfdId) => {
        const newTab: DiagramTab = {
          id,
          type: "dfd",
          label,
          dfdId,
          closeable: true,
        };

        set(
          (state) => ({
            tabs: [...state.tabs, newTab],
            activeTabId: id,
          }),
          false,
          "addDfdTab",
        );
      },

      removeTab: (tabId) => {
        const { tabs, activeTabId } = get();

        // Can't remove the architecture tab
        const tab = tabs.find((t) => t.id === tabId);
        if (!tab || !tab.closeable) return;

        const newTabs = tabs.filter((t) => t.id !== tabId);

        // If removing the active tab, switch to another tab
        let newActiveTabId = activeTabId;
        if (activeTabId === tabId) {
          const tabIndex = tabs.findIndex((t) => t.id === tabId);
          // Try to select the previous tab, or next, or architecture
          if (tabIndex > 0) {
            newActiveTabId = tabs[tabIndex - 1].id;
          } else if (newTabs.length > 0) {
            newActiveTabId = newTabs[0].id;
          } else {
            newActiveTabId = "architecture";
          }
        }

        set(
          {
            tabs: newTabs,
            activeTabId: newActiveTabId,
          },
          false,
          "removeTab",
        );
      },

      renameTab: (tabId, label) => {
        set(
          (state) => ({
            tabs: state.tabs.map((tab) =>
              tab.id === tabId ? { ...tab, label } : tab,
            ),
          }),
          false,
          "renameTab",
        );
      },

      initializeTabs: (sequenceDiagrams, dfds = []) => {
        const sequenceTabs: DiagramTab[] = sequenceDiagrams.map((seq) => ({
          id: `sequence-${seq.id}`,
          type: "sequence" as DiagramType,
          label: seq.name,
          sequenceDiagramId: seq.id,
          closeable: true,
        }));

        const dfdTabs: DiagramTab[] = dfds.map((dfd) => ({
          id: `dfd-${dfd.id}`,
          type: "dfd" as DiagramType,
          label: dfd.name,
          dfdId: dfd.id,
          closeable: true,
        }));

        set(
          {
            tabs: [ARCHITECTURE_TAB, ...dfdTabs, ...sequenceTabs],
            activeTabId: "architecture",
          },
          false,
          "initializeTabs",
        );
      },

      reset: () => {
        set(initialState, false, "reset");
      },
    }),
    { name: "DiagramStore" },
  ),
);

/** Get the active tab type */
export function useActiveTabType(): DiagramType {
  const tabs = useDiagramStore((s) => s.tabs);
  const activeTabId = useDiagramStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  return activeTab?.type ?? "architecture";
}

/** Get the active sequence diagram ID (if on a sequence tab) */
export function useActiveSequenceDiagramId(): string | undefined {
  const tabs = useDiagramStore((s) => s.tabs);
  const activeTabId = useDiagramStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  return activeTab?.type === "sequence"
    ? activeTab.sequenceDiagramId
    : undefined;
}

/** Get the active DFD ID (if on a DFD tab) */
export function useActiveDfdId(): string | undefined {
  const tabs = useDiagramStore((s) => s.tabs);
  const activeTabId = useDiagramStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  return activeTab?.type === "dfd" ? activeTab.dfdId : undefined;
}
