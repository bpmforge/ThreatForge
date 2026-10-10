"use client";

/**
 * useRecentComponents - Tracks recently used palette components in localStorage.
 *
 * Listens for 'ftm-component-placed' custom events dispatched by the canvas
 * when a component is dropped. Stores the last 5 component types.
 * Key: ftm-recent-components
 */

import { useState, useCallback, useEffect } from "react";
import type { ComponentType } from "@/types/canvas";

const STORAGE_KEY = "ftm-recent-components";
const MAX_RECENT = 5;

/** Event name dispatched by canvas on component drop */
const COMPONENT_PLACED_EVENT = "ftm-component-placed";

export function useRecentComponents() {
  const [recentTypes, setRecentTypes] = useState<ComponentType[]>([]);

  const addRecent = useCallback((componentType: ComponentType) => {
    setRecentTypes((prev) => {
      const filtered = prev.filter((t) => t !== componentType);
      const updated = [componentType, ...filtered].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  }, []);

  // Load from localStorage on mount + listen for placement events
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentTypes(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }

    const handler = (e: Event) => {
      const componentType = (e as CustomEvent).detail as ComponentType;
      if (componentType) {
        addRecent(componentType);
      }
    };

    window.addEventListener(COMPONENT_PLACED_EVENT, handler);
    return () => window.removeEventListener(COMPONENT_PLACED_EVENT, handler);
  }, [addRecent]);

  return { recentTypes };
}
