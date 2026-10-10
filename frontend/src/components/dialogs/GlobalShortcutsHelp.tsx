"use client";

/**
 * GlobalShortcutsHelp — listens for the `?` keybind anywhere in the app
 * shell and opens the shortcuts dialog. Mounted once at the (app) layout
 * level so users can discover shortcuts from any page, not just the canvas.
 */
import { useEffect, useState } from "react";
import { ShortcutsHelpDialog } from "./ShortcutsHelpDialog";

export function GlobalShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore inside text inputs / contentEditable so typing "?" works.
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      // Some keyboard layouts emit "?" only with Shift+/.
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return <ShortcutsHelpDialog open={open} onOpenChange={setOpen} />;
}
