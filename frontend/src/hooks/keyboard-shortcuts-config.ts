export interface ShortcutDefinition {
  keys: string[];
  description: string;
  category: "edit" | "view" | "selection" | "navigation";
}

export const SHORTCUTS: ShortcutDefinition[] = [
  {
    keys: ["Delete", "Backspace"],
    description: "Delete selected",
    category: "edit",
  },
  { keys: ["Ctrl/Cmd", "Z"], description: "Undo", category: "edit" },
  { keys: ["Ctrl/Cmd", "Shift", "Z"], description: "Redo", category: "edit" },
  { keys: ["Ctrl/Cmd", "C"], description: "Copy", category: "edit" },
  { keys: ["Ctrl/Cmd", "V"], description: "Paste", category: "edit" },
  { keys: ["Ctrl/Cmd", "D"], description: "Duplicate", category: "edit" },
  { keys: ["Ctrl/Cmd", "A"], description: "Select all", category: "selection" },
  {
    keys: ["Ctrl/Cmd", "Shift", "A"],
    description: "Invert selection",
    category: "selection",
  },
  {
    keys: ["Escape"],
    description: "Deselect / Close panel",
    category: "selection",
  },
  { keys: ["Ctrl/Cmd", "+"], description: "Zoom in", category: "view" },
  { keys: ["Ctrl/Cmd", "-"], description: "Zoom out", category: "view" },
  { keys: ["Ctrl/Cmd", "0"], description: "Fit view", category: "view" },
  { keys: ["Ctrl/Cmd", "F"], description: "Find in diagram", category: "view" },
  {
    keys: ["Ctrl/Cmd", "\\"],
    description: "Toggle outline panel",
    category: "view",
  },
  {
    keys: ["Ctrl/Cmd", "Shift", "F"],
    description: "Fit selection",
    category: "view",
  },
  { keys: ["G"], description: "Toggle grid", category: "view" },
  { keys: ["M"], description: "Toggle minimap", category: "view" },
  { keys: ["Space"], description: "Pan mode (hold)", category: "navigation" },
  { keys: ["?"], description: "Show shortcuts", category: "navigation" },
];

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  onShowHelp?: () => void;
  onEscape?: () => void;
  onToggleGrid?: () => void;
  onToggleSnap?: () => void;
  onToggleMinimap?: () => void;
  onOpenFind?: () => void;
  onToggleOutline?: () => void;
}

export interface UseKeyboardShortcutsReturn {
  isPanMode: boolean;
  showHelp: () => void;
}
