/**
 * AdminSidebar - Navigation sidebar for admin console
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  ScrollText,
  Settings,
  Shield,
  ArrowLeft,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: <Users className="h-4 w-4" />,
  },
  {
    href: "/admin/organizations",
    label: "Organizations",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    href: "/admin/monitoring",
    label: "System Monitoring",
    icon: <Activity className="h-4 w-4" />,
  },
  {
    href: "/admin/audit",
    label: "Audit Log",
    icon: <ScrollText className="h-4 w-4" />,
  },
  {
    href: "/admin/settings",
    label: "System Settings",
    icon: <Settings className="h-4 w-4" />,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b border-slate-800">
        <Shield className="h-6 w-6 text-blue-400 mr-2" />
        <span className="font-semibold text-lg">Admin Console</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
              transition-colors
              ${
                isActive(item.href)
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }
            `}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <Link href="/dashboard">
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to App
          </Button>
        </Link>
      </div>
    </aside>
  );
}
