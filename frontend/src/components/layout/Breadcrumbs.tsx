"use client";

/**
 * Breadcrumbs - Navigation breadcrumb component.
 *
 * Automatically generates breadcrumbs based on current route
 * or can be configured with custom items.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

/** Map route segments to human-readable labels */
const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  models: "Models",
  templates: "Templates",
  settings: "Settings",
  admin: "Admin",
  users: "Users",
  organizations: "Organizations",
  audit: "Audit Log",
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const pathname = usePathname();

  // If custom items provided, use them
  // Otherwise, auto-generate from pathname
  const breadcrumbItems: BreadcrumbItem[] =
    items ?? generateBreadcrumbs(pathname);

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center text-sm text-muted-foreground",
        className,
      )}
    >
      <Link
        href="/dashboard"
        className="hover:text-foreground transition-colors"
        aria-label="Home"
      >
        <Home className="size-4" />
      </Link>

      {breadcrumbItems.map((item, index) => (
        <span key={index} className="flex items-center">
          <ChevronRight className="size-4 mx-2" />
          {item.href && index < breadcrumbItems.length - 1 ? (
            <Link
              href={item.href}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span
              className={cn(
                index === breadcrumbItems.length - 1 &&
                  "text-foreground font-medium",
              )}
            >
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Generate breadcrumbs from pathname */
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);

  if (
    segments.length === 0 ||
    (segments.length === 1 && segments[0] === "dashboard")
  ) {
    return [];
  }

  const items: BreadcrumbItem[] = [];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Skip if this is a dynamic segment (UUID or similar)
    const isDynamicSegment = /^[0-9a-f-]{20,}$/i.test(segment);

    const label = isDynamicSegment
      ? "Details" // Generic label for dynamic segments
      : (routeLabels[segment] ??
        segment.charAt(0).toUpperCase() + segment.slice(1));

    items.push({
      label,
      href: i < segments.length - 1 ? currentPath : undefined,
    });
  }

  return items;
}
