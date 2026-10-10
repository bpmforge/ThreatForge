/**
 * SkipLink - Skip to main content link for keyboard navigation.
 *
 * Provides a way for keyboard users to skip repetitive navigation
 * and jump directly to the main content area.
 *
 * @see WCAG 2.4.1 Bypass Blocks
 */
import { cn } from "@/lib/utils";

interface SkipLinkProps {
  /** Target element ID to skip to */
  targetId?: string;
  /** Custom label text */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

export function SkipLink({
  targetId = "main-content",
  label = "Skip to main content",
  className,
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        // Visually hidden until focused
        "sr-only focus:not-sr-only",
        // Styling when visible
        "focus:fixed focus:top-4 focus:left-4 focus:z-[100]",
        "focus:px-4 focus:py-2 focus:rounded-md",
        "focus:bg-primary focus:text-primary-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "focus:shadow-lg",
        // Transition
        "transition-all duration-150",
        className,
      )}
    >
      {label}
    </a>
  );
}
