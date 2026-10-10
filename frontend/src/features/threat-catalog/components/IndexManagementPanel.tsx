"use client";

/**
 * IndexManagementPanel - Displays and manages threat catalog indexes.
 * Shows stats and last updated dates. The indexes are bundled static data,
 * updated with each release, so there is nothing to refresh at runtime.
 */
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Database,
  Shield,
  Bug,
  Target,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { getCatalogStatsAPI, type CatalogStats } from "../services/api";
import { toast } from "sonner";

interface IndexInfo {
  name: string;
  icon: typeof Database;
  color: string;
  total: number;
  lastUpdated: string;
  version: string;
  status: "current" | "outdated" | "unknown";
}

export function IndexManagementPanel() {
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getCatalogStatsAPI();
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
      toast.error("Failed to load catalog statistics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p>Failed to load statistics</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={loadStats}
        >
          Retry
        </Button>
      </div>
    );
  }

  const indexes: IndexInfo[] = [
    {
      name: "CWE Database",
      icon: Bug,
      color: "bg-blue-500",
      total: stats.cwe.total,
      lastUpdated: stats.cwe.lastUpdated,
      version: stats.cwe.version,
      status: "current",
    },
    {
      name: "MITRE ATT&CK",
      icon: Target,
      color: "bg-red-500",
      total: stats.indexes.mitreAttack.total,
      lastUpdated: stats.indexes.mitreAttack.lastUpdated,
      version: stats.indexes.mitreAttack.version,
      status: "current",
    },
    {
      name: "CAPEC",
      icon: Shield,
      color: "bg-purple-500",
      total: stats.indexes.capec.total,
      lastUpdated: stats.indexes.capec.lastUpdated,
      version: stats.indexes.capec.version,
      status: "current",
    },
  ];

  const totalCoverage = Math.round(
    (stats.totalSearchable / stats.totalWithIndexes) * 100,
  );

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Catalog Coverage
          </CardTitle>
          <CardDescription className="text-xs">
            {stats.totalSearchable.toLocaleString()} searchable threats from{" "}
            {stats.totalWithIndexes.toLocaleString()} indexed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Search Coverage</span>
              <span className="font-medium">{totalCoverage}%</span>
            </div>
            <Progress value={totalCoverage} className="h-2" />
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <p className="text-muted-foreground">Built-in Threats</p>
                <p className="text-lg font-semibold">{stats.builtIn.total}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Extended CWE</p>
                <p className="text-lg font-semibold">{stats.cwe.total}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Index Cards */}
      <div className="grid grid-cols-1 gap-3">
        {indexes.map((index) => {
          const Icon = index.icon;

          return (
            <Card key={index.name}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${index.color} text-white`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{index.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs">
                          {index.total.toLocaleString()} entries
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            index.status === "current"
                              ? "text-green-600 border-green-300"
                              : "text-yellow-600 border-yellow-300"
                          }`}
                        >
                          {index.status === "current" ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <AlertCircle className="h-3 w-3 mr-1" />
                          )}
                          v{index.version}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last updated: {index.lastUpdated}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">CWE by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {Object.entries(stats.cwe.byCategory).map(([category, count]) => (
              <div
                key={category}
                className="flex justify-between p-2 bg-muted/50 rounded"
              >
                <span className="capitalize text-xs">
                  {category.replace(/-/g, " ")}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {count}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
