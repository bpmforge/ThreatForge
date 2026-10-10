/**
 * Sidebar navigation configuration.
 * Single source of truth for all nav item arrays.
 */
import {
  LayoutDashboard,
  FolderKanban,
  FileStack,
  ShieldCheck,
  User,
  Building2,
  BarChart3,
  Route,
  Target,
  ClipboardCheck,
  FileBarChart,
  Bell,
  CheckSquare,
  TrendingUp,
  Library,
  Box,
  GitCompare,
  Package,
  Store,
  ScanLine,
  Layers,
} from "lucide-react";

export const mainNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  {
    title: "Projects",
    url: "/projects",
    icon: FolderKanban,
    isCollapsible: true,
  },
  { title: "Templates", url: "/templates", icon: FileStack },
  { title: "Marketplace", url: "/marketplace", icon: Store },
];

export const analyticsNavItems = [
  { title: "Risk Dashboard", url: "/analytics/risk", icon: BarChart3 },
  { title: "Attack Paths", url: "/analytics/attack-paths", icon: Route },
  { title: "Attack Surface", url: "/analytics/attack-surface", icon: Target },
  { title: "Compliance", url: "/analytics/compliance", icon: ClipboardCheck },
  { title: "Portfolio", url: "/analytics/portfolio", icon: TrendingUp },
  { title: "Compare", url: "/analytics/compare", icon: GitCompare },
  { title: "Patterns", url: "/analytics/patterns", icon: Layers },
  { title: "Supply Chain", url: "/analytics/supply-chain", icon: Package },
  { title: "Security Scans", url: "/analytics/scanners", icon: ScanLine },
];

export const libraryNavItems = [
  { title: "Threat Library", url: "/libraries/threats", icon: Library },
  { title: "Component Templates", url: "/libraries/components", icon: Box },
  {
    title: "Compliance Frameworks",
    url: "/libraries/compliance",
    icon: ShieldCheck,
  },
];

export const reportsNavItems = [
  { title: "Executive Reports", url: "/reports", icon: FileBarChart },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Reviews", url: "/reviews", icon: CheckSquare },
];

export const userNavItems = [{ title: "Profile", url: "/profile", icon: User }];

export const orgAdminNavItems = [
  { title: "Organization", url: "/organization", icon: Building2 },
];

export const systemAdminNavItems = [
  { title: "Admin", url: "/admin", icon: ShieldCheck },
];
