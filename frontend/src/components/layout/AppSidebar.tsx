"use client";

import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { OrgSwitcher } from "@/features/organizations";
import { SidebarUserFooter } from "./SidebarUserFooter";
import { useSidebarState } from "./useSidebarState";
import { SidebarMainNav } from "./SidebarMainNav";
import { SidebarNavGroup } from "./SidebarNavGroup";
import {
  analyticsNavItems,
  libraryNavItems,
  reportsNavItems,
  userNavItems,
  orgAdminNavItems,
  systemAdminNavItems,
} from "./sidebarNavConfig";

export function AppSidebar() {
  const { pathname, recentProjects, isSystemAdmin, isOrgAdmin, isActive } =
    useSidebarState();

  const allUserNavItems = [
    ...userNavItems,
    ...(isOrgAdmin ? orgAdminNavItems : []),
    ...(isSystemAdmin ? systemAdminNavItems : []),
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <OrgSwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMainNav
          recentProjects={recentProjects}
          isActive={isActive}
          pathname={pathname}
        />

        <SidebarSeparator />

        <SidebarNavGroup
          label="Analytics"
          items={analyticsNavItems}
          isActive={isActive}
        />

        <SidebarSeparator />

        <SidebarNavGroup
          label="Libraries"
          items={libraryNavItems}
          isActive={isActive}
          collapsible
          defaultOpen={false}
        />

        <SidebarSeparator />

        <SidebarNavGroup
          label="Reports"
          items={reportsNavItems}
          isActive={isActive}
          collapsible
          defaultOpen={false}
        />

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {allUserNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={isActive(item.url)}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarUserFooter />
      <SidebarRail />
    </Sidebar>
  );
}
