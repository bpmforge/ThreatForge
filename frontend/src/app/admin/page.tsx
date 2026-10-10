/**
 * Admin Dashboard Page
 *
 * Displays system statistics and health overview.
 */
"use client";

import { Users, Building2, FolderKanban, Shield, Activity } from "lucide-react";
import {
  StatsCard,
  SystemHealthCard,
  useAdminStats,
  useSystemHealth,
} from "@/features/admin";

export default function AdminDashboardPage() {
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useAdminStats();
  const {
    data: health,
    isLoading: healthLoading,
    error: healthError,
  } = useSystemHealth();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          System overview and statistics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Users"
          value={statsLoading ? "..." : (stats?.totalUsers ?? 0)}
          icon={<Users className="h-6 w-6" />}
          trend={
            stats?.usersThisMonth
              ? {
                  value: stats.usersThisMonth,
                  label: "this month",
                }
              : undefined
          }
        />
        <StatsCard
          title="Organizations"
          value={statsLoading ? "..." : (stats?.totalOrganizations ?? 0)}
          icon={<Building2 className="h-6 w-6" />}
        />
        <StatsCard
          title="Projects"
          value={statsLoading ? "..." : (stats?.totalProjects ?? 0)}
          icon={<FolderKanban className="h-6 w-6" />}
          trend={
            stats?.projectsThisMonth
              ? {
                  value: stats.projectsThisMonth,
                  label: "this month",
                }
              : undefined
          }
        />
        <StatsCard
          title="Threat Models"
          value={statsLoading ? "..." : (stats?.totalThreatModels ?? 0)}
          icon={<Shield className="h-6 w-6" />}
          trend={
            stats?.threatModelsThisMonth
              ? {
                  value: stats.threatModelsThisMonth,
                  label: "this month",
                }
              : undefined
          }
        />
      </div>

      {/* Health and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SystemHealthCard
          health={health}
          isLoading={healthLoading}
          error={healthError}
        />

        {/* Activity Summary */}
        <div className="lg:col-span-2 bg-background rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            <Activity className="h-5 w-5 inline-block mr-2 text-muted-foreground" />
            Recent Activity
          </h2>
          {statsError ? (
            <p className="text-red-600 text-sm">Failed to load activity</p>
          ) : statsLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Active users (24h)
                </span>
                <span className="font-medium">
                  {stats?.activeUsersToday ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  New users this month
                </span>
                <span className="font-medium text-green-600">
                  +{stats?.usersThisMonth ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  New projects this month
                </span>
                <span className="font-medium text-green-600">
                  +{stats?.projectsThisMonth ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Threat models this month
                </span>
                <span className="font-medium text-green-600">
                  +{stats?.threatModelsThisMonth ?? 0}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
