"use client";

/**
 * App Shell Layout
 *
 * Provides the persistent sidebar and header for main application pages.
 * Uses shadcn sidebar component for responsive navigation.
 * Includes OrgProvider for organization context management.
 * Includes CommandPalette for global search (Cmd/Ctrl+K).
 * Includes MFA enforcement check.
 */
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { OrgProvider } from "@/features/organizations";
import { CommandPalette } from "@/features/search";
import { ActiveJobsList } from "@/features/ai-jobs";
import { GlobalShortcutsHelp } from "@/components/dialogs/GlobalShortcutsHelp";
import { OnboardingWizard } from "@/components/onboarding";
import { useUIStore } from "@/stores/ui-store";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const tourOpen = useUIStore((s) => s.tourOpen);
  const closeTour = useUIStore((s) => s.closeTour);

  // MFA enforcement: redirect users who need to set up 2FA
  useEffect(() => {
    if (status === "authenticated" && session?.user?.requiresMfaSetup) {
      // Allow access to profile page (where 2FA setup is) and API routes
      const allowedPaths = ["/profile", "/api"];
      const isAllowed = allowedPaths.some((path) => pathname.startsWith(path));

      if (!isAllowed) {
        router.push("/profile?tab=security&mfa=required");
      }
    }
  }, [status, session, pathname, router]);

  return (
    <OrgProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
        <CommandPalette />
        <ActiveJobsList />
        <GlobalShortcutsHelp />
        <OnboardingWizard
          isOpen={tourOpen}
          onOpenChange={(open) => {
            if (!open) closeTour();
          }}
          onComplete={closeTour}
        />
      </SidebarProvider>
    </OrgProvider>
  );
}
