"use client";

/**
 * Organization Switcher Component
 *
 * Dropdown component for switching between organizations.
 * Displays current organization and allows selection from user's organizations.
 */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronsUpDown,
  Plus,
  Check,
  ShieldCheck,
  Users,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useOrganizations } from "../hooks/useOrganization";
import { useOrgStore } from "@/stores/org-store";
import type { OrganizationSummary } from "../types";

interface OrgSwitcherProps {
  /** Compact mode for collapsed sidebar */
  compact?: boolean;
}

/** Get icon based on organization type */
function getOrgIcon(org: OrganizationSummary) {
  if (org.isPersonal) return User;
  if (org.type === "ENTERPRISE") return Building2;
  return Users;
}

/** Format organization subtitle */
function getOrgSubtitle(org: OrganizationSummary): string {
  if (org.isPersonal) return "Personal";
  return `${org.memberCount} member${org.memberCount !== 1 ? "s" : ""}`;
}

export function OrgSwitcher({ compact = false }: OrgSwitcherProps) {
  const router = useRouter();
  const { data: organizations, isLoading } = useOrganizations();
  const { currentOrgId, setCurrentOrg } = useOrgStore();

  // Defer org-dependent text until after mount — server has no org data,
  // client resolves to the real org name. Text mismatch causes React #418.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Find current organization
  const currentOrg = mounted
    ? organizations?.find((org) => org.id === currentOrgId)
    : undefined;

  // Handle organization selection
  const handleSelectOrg = (org: OrganizationSummary) => {
    if (org.id !== currentOrgId) {
      setCurrentOrg(org.id);
      // Navigate to dashboard to refresh context
      router.push("/dashboard");
    }
  };

  // Handle create organization
  const handleCreateOrg = () => {
    router.push("/settings/organizations/new");
  };

  // Loading state
  if (isLoading) {
    return (
      <SidebarMenuButton size="lg" disabled>
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted animate-pulse" />
        <div className="flex flex-col gap-0.5 leading-none">
          <span className="font-semibold">Loading...</span>
        </div>
      </SidebarMenuButton>
    );
  }

  // Current org display
  const _OrgIcon = currentOrg ? getOrgIcon(currentOrg) : Building2;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent"
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <ShieldCheck className="size-4" />
          </div>
          {!compact && (
            <>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">ThreatForge</span>
                <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                  {currentOrg?.name ?? "Select Organization"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </>
          )}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
        align="start"
      >
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations?.map((org) => {
          const Icon = getOrgIcon(org);
          const isSelected = org.id === currentOrgId;
          return (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSelectOrg(org)}
              className="cursor-pointer"
            >
              <Icon className="mr-2 size-4" />
              <div className="flex flex-col flex-1">
                <span className={isSelected ? "font-medium" : ""}>
                  {org.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {getOrgSubtitle(org)}
                </span>
              </div>
              {isSelected && <Check className="ml-2 size-4 text-blue-600" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCreateOrg} className="cursor-pointer">
          <Plus className="mr-2 size-4" />
          <span>Create Organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
