/**
 * ShortcutsHelpDialog - Display keyboard shortcuts help.
 *
 * Shows all available keyboard shortcuts organized by category.
 * Triggered by pressing '?' key.
 */
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";
import {
  SHORTCUTS,
  type ShortcutDefinition,
} from "@/hooks/useKeyboardShortcuts";

interface ShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryLabels: Record<ShortcutDefinition["category"], string> = {
  edit: "Edit",
  view: "View",
  selection: "Selection",
  navigation: "Navigation",
};

const categoryOrder: ShortcutDefinition["category"][] = [
  "edit",
  "selection",
  "view",
  "navigation",
];

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium text-foreground bg-muted border border rounded shadow-sm">
      {children}
    </kbd>
  );
}

function ShortcutRow({ shortcut }: { shortcut: ShortcutDefinition }) {
  // Check if Mac for display
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  const displayKeys = shortcut.keys.map((key) => {
    if (key === "Ctrl/Cmd") {
      return isMac ? "⌘" : "Ctrl";
    }
    if (key === "Shift") {
      return isMac ? "⇧" : "Shift";
    }
    return key;
  });

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {displayKeys.map((key, i) => (
          <KeyBadge key={i}>{key}</KeyBadge>
        ))}
      </div>
    </div>
  );
}

export function ShortcutsHelpDialog({
  open,
  onOpenChange,
}: ShortcutsHelpDialogProps) {
  // Group shortcuts by category
  const shortcutsByCategory = categoryOrder.reduce(
    (acc, category) => {
      acc[category] = SHORTCUTS.filter((s) => s.category === category);
      return acc;
    },
    {} as Record<ShortcutDefinition["category"], ShortcutDefinition[]>,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {categoryOrder.map((category) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {categoryLabels[category]}
              </h3>
              <div className="space-y-0.5">
                {shortcutsByCategory[category].map((shortcut, i) => (
                  <ShortcutRow key={i} shortcut={shortcut} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Press <KeyBadge>?</KeyBadge> anytime to show this dialog
        </div>
      </DialogContent>
    </Dialog>
  );
}
