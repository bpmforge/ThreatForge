/**
 * useKeyboardShortcuts Tests
 *
 * Tests for keyboard shortcut definitions and utility logic.
 */
import { describe, it, expect } from "vitest";
import { SHORTCUTS } from "./useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  describe("SHORTCUTS definition", () => {
    it("should have shortcuts for all categories", () => {
      const categories = new Set(SHORTCUTS.map((s) => s.category));
      expect(categories.has("edit")).toBe(true);
      expect(categories.has("view")).toBe(true);
      expect(categories.has("selection")).toBe(true);
      expect(categories.has("navigation")).toBe(true);
    });

    it("should have delete shortcut", () => {
      const deleteShortcut = SHORTCUTS.find(
        (s) => s.description === "Delete selected",
      );
      expect(deleteShortcut).toBeDefined();
      expect(deleteShortcut?.keys).toContain("Delete");
      expect(deleteShortcut?.keys).toContain("Backspace");
    });

    it("should have undo shortcut", () => {
      const undoShortcut = SHORTCUTS.find((s) => s.description === "Undo");
      expect(undoShortcut).toBeDefined();
      expect(undoShortcut?.keys).toContain("Z");
    });

    it("should have redo shortcut", () => {
      const redoShortcut = SHORTCUTS.find((s) => s.description === "Redo");
      expect(redoShortcut).toBeDefined();
      expect(redoShortcut?.keys).toContain("Shift");
      expect(redoShortcut?.keys).toContain("Z");
    });

    it("should have copy shortcut", () => {
      const copyShortcut = SHORTCUTS.find((s) => s.description === "Copy");
      expect(copyShortcut).toBeDefined();
      expect(copyShortcut?.keys).toContain("C");
    });

    it("should have paste shortcut", () => {
      const pasteShortcut = SHORTCUTS.find((s) => s.description === "Paste");
      expect(pasteShortcut).toBeDefined();
      expect(pasteShortcut?.keys).toContain("V");
    });

    it("should have duplicate shortcut", () => {
      const duplicateShortcut = SHORTCUTS.find(
        (s) => s.description === "Duplicate",
      );
      expect(duplicateShortcut).toBeDefined();
      expect(duplicateShortcut?.keys).toContain("D");
    });

    it("should have select all shortcut", () => {
      const selectAllShortcut = SHORTCUTS.find(
        (s) => s.description === "Select all",
      );
      expect(selectAllShortcut).toBeDefined();
      expect(selectAllShortcut?.keys).toContain("A");
    });

    it("should have escape shortcut", () => {
      const escapeShortcut = SHORTCUTS.find(
        (s) => s.description === "Deselect / Close panel",
      );
      expect(escapeShortcut).toBeDefined();
      expect(escapeShortcut?.keys).toContain("Escape");
    });

    it("should have zoom shortcuts", () => {
      const zoomIn = SHORTCUTS.find((s) => s.description === "Zoom in");
      const zoomOut = SHORTCUTS.find((s) => s.description === "Zoom out");
      const fitView = SHORTCUTS.find((s) => s.description === "Fit view");

      expect(zoomIn).toBeDefined();
      expect(zoomIn?.keys).toContain("+");

      expect(zoomOut).toBeDefined();
      expect(zoomOut?.keys).toContain("-");

      expect(fitView).toBeDefined();
      expect(fitView?.keys).toContain("0");
    });

    it("should have grid toggle shortcut", () => {
      const gridShortcut = SHORTCUTS.find(
        (s) => s.description === "Toggle grid",
      );
      expect(gridShortcut).toBeDefined();
      expect(gridShortcut?.keys).toContain("G");
      expect(gridShortcut?.category).toBe("view");
    });

    it("should have minimap toggle shortcut", () => {
      const minimapShortcut = SHORTCUTS.find(
        (s) => s.description === "Toggle minimap",
      );
      expect(minimapShortcut).toBeDefined();
      expect(minimapShortcut?.keys).toContain("M");
      expect(minimapShortcut?.category).toBe("view");
    });

    it("should have pan mode shortcut", () => {
      const panShortcut = SHORTCUTS.find(
        (s) => s.description === "Pan mode (hold)",
      );
      expect(panShortcut).toBeDefined();
      expect(panShortcut?.keys).toContain("Space");
      expect(panShortcut?.category).toBe("navigation");
    });

    it("should have help shortcut", () => {
      const helpShortcut = SHORTCUTS.find(
        (s) => s.description === "Show shortcuts",
      );
      expect(helpShortcut).toBeDefined();
      expect(helpShortcut?.keys).toContain("?");
    });

    it("should have all edit shortcuts", () => {
      const editShortcuts = SHORTCUTS.filter((s) => s.category === "edit");
      expect(editShortcuts.length).toBeGreaterThanOrEqual(5);

      const descriptions = editShortcuts.map((s) => s.description);
      expect(descriptions).toContain("Delete selected");
      expect(descriptions).toContain("Undo");
      expect(descriptions).toContain("Redo");
      expect(descriptions).toContain("Copy");
      expect(descriptions).toContain("Paste");
    });

    it("should have all view shortcuts", () => {
      const viewShortcuts = SHORTCUTS.filter((s) => s.category === "view");
      expect(viewShortcuts.length).toBeGreaterThanOrEqual(5);

      const descriptions = viewShortcuts.map((s) => s.description);
      expect(descriptions).toContain("Zoom in");
      expect(descriptions).toContain("Zoom out");
      expect(descriptions).toContain("Fit view");
      expect(descriptions).toContain("Toggle grid");
      expect(descriptions).toContain("Toggle minimap");
    });

    it("should have valid shortcut structure", () => {
      SHORTCUTS.forEach((shortcut) => {
        expect(shortcut.keys).toBeDefined();
        expect(shortcut.keys.length).toBeGreaterThan(0);
        expect(shortcut.description).toBeDefined();
        expect(shortcut.description.length).toBeGreaterThan(0);
        expect(["edit", "view", "selection", "navigation"]).toContain(
          shortcut.category,
        );
      });
    });

    it("should not have duplicate descriptions", () => {
      const descriptions = SHORTCUTS.map((s) => s.description);
      const uniqueDescriptions = new Set(descriptions);
      expect(uniqueDescriptions.size).toBe(descriptions.length);
    });
  });

  describe("shortcut categories", () => {
    it("should group edit shortcuts correctly", () => {
      const editShortcuts = SHORTCUTS.filter((s) => s.category === "edit");
      const editDescriptions = editShortcuts.map((s) => s.description);

      // All edit actions should be in edit category
      expect(editDescriptions).toContain("Delete selected");
      expect(editDescriptions).toContain("Undo");
      expect(editDescriptions).toContain("Redo");
      expect(editDescriptions).toContain("Copy");
      expect(editDescriptions).toContain("Paste");
      expect(editDescriptions).toContain("Duplicate");
    });

    it("should group selection shortcuts correctly", () => {
      const selectionShortcuts = SHORTCUTS.filter(
        (s) => s.category === "selection",
      );
      const selectionDescriptions = selectionShortcuts.map(
        (s) => s.description,
      );

      expect(selectionDescriptions).toContain("Select all");
      expect(selectionDescriptions).toContain("Deselect / Close panel");
    });

    it("should group view shortcuts correctly", () => {
      const viewShortcuts = SHORTCUTS.filter((s) => s.category === "view");
      const viewDescriptions = viewShortcuts.map((s) => s.description);

      expect(viewDescriptions).toContain("Zoom in");
      expect(viewDescriptions).toContain("Zoom out");
      expect(viewDescriptions).toContain("Fit view");
      expect(viewDescriptions).toContain("Toggle grid");
      expect(viewDescriptions).toContain("Toggle minimap");
    });

    it("should group navigation shortcuts correctly", () => {
      const navShortcuts = SHORTCUTS.filter((s) => s.category === "navigation");
      const navDescriptions = navShortcuts.map((s) => s.description);

      expect(navDescriptions).toContain("Pan mode (hold)");
      expect(navDescriptions).toContain("Show shortcuts");
    });
  });
});
