"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useProjects, type ProjectSummary } from "@/features/projects";
import { useOrgPermissions } from "@/features/organizations";
import { useCurrentOrgId } from "@/stores/org-store";

export function useSidebarState() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const currentOrgId = useCurrentOrgId();
  const { isAdminOf } = useOrgPermissions();

  const { data: projectsData } = useProjects({
    organizationId: currentOrgId ?? undefined,
  });
  const recentProjects: ProjectSummary[] = (projectsData ?? []).slice(0, 5);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isSystemAdmin = mounted
    ? (session?.user?.isSystemAdmin ?? false)
    : false;
  const isOrgAdmin = mounted
    ? currentOrgId
      ? isAdminOf(currentOrgId)
      : false
    : false;

  const isActive = (url: string) => pathname.startsWith(url);

  return {
    pathname,
    session,
    currentOrgId,
    recentProjects,
    isSystemAdmin,
    isOrgAdmin,
    isActive,
  };
}
