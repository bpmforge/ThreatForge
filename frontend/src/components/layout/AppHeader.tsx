"use client";

/**
 * AppHeader - Main application header with breadcrumbs and actions.
 *
 * Used within the app shell to show current location and page-specific actions.
 * Includes a Cmd+K search trigger and notification bell popover.
 */
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";
import { Menu, Search } from "lucide-react";
import { NotificationCenter } from "@/features/notifications";
import { useCommandPalette } from "@/features/search";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface AppHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  children?: React.ReactNode;
}

export function AppHeader({ breadcrumbs, children }: AppHeaderProps) {
  const { open: openSearch } = useCommandPalette();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1 md:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </SidebarTrigger>
      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="mr-2 h-4 hidden md:block" />
      <Breadcrumbs items={breadcrumbs} className="flex-1" />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={openSearch}
          aria-label="Search (Cmd+K)"
        >
          <Search className="h-5 w-5" />
        </Button>
        <NotificationCenter />
        {children}
      </div>
    </header>
  );
}
