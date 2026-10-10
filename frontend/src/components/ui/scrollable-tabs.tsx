"use client";

/**
 * ScrollableTabs - Horizontal tab bar with scroll arrows when content overflows.
 *
 * Used for panel tab bars (right panel, cloud filter) where tabs may exceed
 * the container width. Shows chevron arrows on either side when scrollable.
 */
import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface ScrollableTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
  suffix?: React.ReactNode;
  ariaLabel?: string;
  ariaControls?: string;
}

export function ScrollableTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
  suffix,
  ariaLabel,
  ariaControls,
}: ScrollableTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, [checkScroll, tabs]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -120 : 120,
      behavior: "smooth",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = tabs.findIndex((t) => t.key === activeTab);
    if (e.key === "ArrowRight" && currentIndex < tabs.length - 1) {
      e.preventDefault();
      onTabChange(tabs[currentIndex + 1].key);
    } else if (e.key === "ArrowLeft" && currentIndex > 0) {
      e.preventDefault();
      onTabChange(tabs[currentIndex - 1].key);
    }
  };

  return (
    <div className={cn("flex items-center border-b shrink-0", className)}>
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="shrink-0 px-1 py-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Scroll tabs left"
          tabIndex={-1}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex items-center overflow-x-auto scrollbar-hide flex-1 min-w-0"
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={ariaControls}
            tabIndex={activeTab === tab.key ? 0 : -1}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "shrink-0 flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              activeTab === tab.key
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground",
            )}
          >
            {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
            {tab.label}
          </button>
        ))}
      </div>

      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="shrink-0 px-1 py-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Scroll tabs right"
          tabIndex={-1}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {suffix}
    </div>
  );
}
