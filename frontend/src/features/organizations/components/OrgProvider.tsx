"use client";

/**
 * Organization Provider Component
 *
 * Initializes organization context based on user's memberships.
 * Should be placed near the root of authenticated routes.
 * Does NOT block rendering - children are always rendered.
 */
import { useEffect } from "react";
import { useOrgStore } from "@/stores/org-store";
import { useOrganizations } from "../hooks/useOrganization";

interface OrgProviderProps {
  children: React.ReactNode;
}

export function OrgProvider({ children }: OrgProviderProps) {
  const {
    data: organizations,
    isLoading,
    isFetching,
    error,
  } = useOrganizations();
  const { currentOrgId, initializeOrg, setCurrentOrg } = useOrgStore();

  // Initialize org context when organizations load
  useEffect(() => {
    // Don't do anything while still loading or if data hasn't arrived yet
    if (isLoading || isFetching) return;

    // Handle error case - still mark as initialized so app doesn't hang
    if (error) {
      initializeOrg(null);
      return;
    }

    // No organizations data yet
    if (!organizations) {
      initializeOrg(null);
      return;
    }

    // If we have organizations but no current org, select the first one
    if (organizations.length > 0 && !currentOrgId) {
      // Prefer personal org, then first available
      const personalOrg = organizations.find((org) => org.isPersonal);
      const defaultOrg = personalOrg || organizations[0];
      setCurrentOrg(defaultOrg.id);
    } else if (organizations.length > 0 && currentOrgId) {
      // Validate that current org still exists in user's memberships
      const orgExists = organizations.some((org) => org.id === currentOrgId);
      if (!orgExists) {
        // Reset to first available org
        const defaultOrg = organizations[0];
        setCurrentOrg(defaultOrg.id);
      } else {
        // Mark as initialized
        initializeOrg(currentOrgId);
      }
    } else if (organizations.length === 0) {
      // No organizations - clear context and mark as initialized
      initializeOrg(null);
    }
  }, [
    organizations,
    isLoading,
    isFetching,
    error,
    currentOrgId,
    initializeOrg,
    setCurrentOrg,
  ]);

  // Always render children - don't block on org loading
  return <>{children}</>;
}
