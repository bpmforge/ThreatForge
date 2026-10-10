/**
 * VisuallyHidden - Visually hide content while keeping it accessible.
 *
 * Hides content from sighted users while keeping it readable
 * by screen readers. Useful for additional context that's
 * only needed for accessibility.
 *
 * @see https://www.scottohara.me/blog/2017/04/14/inclusively-hidden.html
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface VisuallyHiddenProps {
  /** Content to hide visually */
  children: ReactNode;
  /** Render as a span instead of div */
  as?: "div" | "span";
  /** Additional CSS classes */
  className?: string;
}

export function VisuallyHidden({
  children,
  as: Component = "span",
  className,
}: VisuallyHiddenProps) {
  return <Component className={cn("sr-only", className)}>{children}</Component>;
}
