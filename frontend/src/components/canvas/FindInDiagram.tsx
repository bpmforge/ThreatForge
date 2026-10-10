"use client";

/**
 * FindInDiagram - Floating search bar for finding nodes on the canvas.
 * Ctrl/Cmd+F opens; Escape or X closes. Highlights matched nodes with
 * a yellow ring via data.highlighted and centers the viewport on each.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { ChevronUp, ChevronDown, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/stores/canvas";

interface FindInDiagramProps {
  onClose: () => void;
}

/** Set highlighted flag on all component nodes; pass null to clear all. */
function setHighlights(activeId: string | null) {
  useCanvasStore.setState((state) => ({
    nodes: state.nodes.map((n) =>
      n.type === "component"
        ? { ...n, data: { ...n.data, highlighted: n.id === activeId } }
        : n,
    ),
  }));
}

export function FindInDiagram({ onClose }: FindInDiagramProps) {
  const [query, setQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setCenter } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clear highlights on unmount
  useEffect(() => () => setHighlights(null), []);

  const allNodes = useCanvasStore((s) => s.nodes);
  const matches = query.trim()
    ? allNodes.filter(
        (n) =>
          n.type === "component" &&
          typeof n.data.label === "string" &&
          n.data.label.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

  // Reset index when query changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [query]);

  const navigateTo = useCallback(
    (index: number) => {
      const node = matches[index];
      if (!node) return;
      const w = (node.measured?.width as number | undefined) ?? 160;
      const h = (node.measured?.height as number | undefined) ?? 60;
      setCenter(node.position.x + w / 2, node.position.y + h / 2, {
        zoom,
        duration: 300,
      });
      setHighlights(node.id);
    },
    [matches, setCenter, zoom],
  );

  useEffect(() => {
    if (matches.length > 0) navigateTo(currentIndex);
    else if (query.trim()) setHighlights(null);
  }, [currentIndex, matches.length, navigateTo, query]);

  const goNext = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIndex((i) => (i + 1) % matches.length);
  }, [matches.length]);

  const goPrev = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIndex((i) => (i - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const handleClose = useCallback(() => {
    setHighlights(null);
    onClose();
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.shiftKey ? goPrev() : goNext();
    }
  };

  const matchLabel =
    query.trim() && matches.length > 0
      ? `${currentIndex + 1} of ${matches.length}`
      : query.trim()
        ? "No matches"
        : "";

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-background border border-border rounded-lg shadow-lg px-2 py-1.5">
      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find nodes..."
        className="h-7 w-48 border-0 shadow-none focus-visible:ring-0 text-sm"
      />
      {matchLabel && (
        <span className="text-xs text-muted-foreground whitespace-nowrap px-1">
          {matchLabel}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={goPrev}
        disabled={matches.length === 0}
        aria-label="Previous match"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={goNext}
        disabled={matches.length === 0}
        aria-label="Next match"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={handleClose}
        aria-label="Close find"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
