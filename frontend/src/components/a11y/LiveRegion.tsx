/**
 * LiveRegion - Announces dynamic content changes to screen readers.
 *
 * Uses ARIA live regions to announce status updates, notifications,
 * and other dynamic content changes without requiring user focus.
 *
 * @see WCAG 4.1.3 Status Messages
 */
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";

type LiveRegionPoliteness = "polite" | "assertive" | "off";

interface Announcement {
  id: string;
  message: string;
  politeness: LiveRegionPoliteness;
}

interface LiveRegionContextValue {
  /** Announce a message to screen readers */
  announce: (message: string, politeness?: LiveRegionPoliteness) => void;
  /** Clear all announcements */
  clear: () => void;
}

const LiveRegionContext = createContext<LiveRegionContextValue | null>(null);

interface LiveRegionProviderProps {
  children: ReactNode;
  /** Delay before clearing announcements (ms) */
  clearDelay?: number;
}

/**
 * Provider that manages live region announcements.
 * Wrap your app with this to enable the useAnnounce hook.
 */
export function LiveRegionProvider({
  children,
  clearDelay = 5000,
}: LiveRegionProviderProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const announce = useCallback(
    (message: string, politeness: LiveRegionPoliteness = "polite") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      setAnnouncements((prev) => [...prev, { id, message, politeness }]);

      // Clear after delay
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setAnnouncements([]);
      }, clearDelay);
    },
    [clearDelay],
  );

  const clear = useCallback(() => {
    setAnnouncements([]);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Group announcements by politeness
  const politeMessages = announcements
    .filter((a) => a.politeness === "polite")
    .map((a) => a.message)
    .join(". ");

  const assertiveMessages = announcements
    .filter((a) => a.politeness === "assertive")
    .map((a) => a.message)
    .join(". ");

  return (
    <LiveRegionContext.Provider value={{ announce, clear }}>
      {children}

      {/* Polite live region - for non-urgent updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessages}
      </div>

      {/* Assertive live region - for urgent updates */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessages}
      </div>
    </LiveRegionContext.Provider>
  );
}

/**
 * Hook to announce messages to screen readers.
 *
 * @example
 * const { announce } = useAnnounce();
 * announce('Item saved successfully');
 * announce('Error: Failed to save', 'assertive');
 */
export function useAnnounce() {
  const context = useContext(LiveRegionContext);

  if (!context) {
    // Return a no-op if not within provider (graceful degradation)
    return {
      announce: () => {},
      clear: () => {},
    };
  }

  return context;
}
