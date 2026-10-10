"use client";

import { useMemo } from "react";
import type {
  AttackSurfaceComponent,
  ExposureMatrixEntry,
  InterfaceType,
  NetworkExposure,
} from "../types";
import { cn } from "@/lib/utils";

interface AttackSurfaceChartProps {
  components: AttackSurfaceComponent[];
  exposureMatrix: ExposureMatrixEntry[];
}

export function AttackSurfaceChart({
  components,
  exposureMatrix,
}: AttackSurfaceChartProps) {
  // Group by interface type for bar chart
  const interfaceTypeData = useMemo(() => {
    const data: Record<string, { count: number; avgRisk: number }> = {};
    exposureMatrix.forEach((entry) => {
      if (!data[entry.interfaceType]) {
        data[entry.interfaceType] = { count: 0, avgRisk: 0 };
      }
      data[entry.interfaceType].count += entry.count;
      data[entry.interfaceType].avgRisk += entry.avgRiskScore * entry.count;
    });
    // Calculate weighted average
    Object.keys(data).forEach((type) => {
      if (data[type].count > 0) {
        data[type].avgRisk /= data[type].count;
      }
    });
    return data;
  }, [exposureMatrix]);

  const maxCount = useMemo(
    () => Math.max(...Object.values(interfaceTypeData).map((d) => d.count), 1),
    [interfaceTypeData],
  );

  const getRiskColor = (risk: number) => {
    if (risk >= 8) return "bg-red-500";
    if (risk >= 6) return "bg-orange-500";
    if (risk >= 4) return "bg-yellow-500";
    return "bg-green-500";
  };

  const interfaceTypeLabels: Partial<Record<InterfaceType, string>> = {
    HTTP_API: "HTTP API",
    GRPC_API: "gRPC",
    GRAPHQL_API: "GraphQL",
    WEBSOCKET: "WebSocket",
    DATABASE: "Database",
    MESSAGE_QUEUE: "Message Queue",
    FILE_STORAGE: "File Storage",
    EXTERNAL_SERVICE: "External",
    USER_INTERFACE: "UI",
    NETWORK_PORT: "Network Port",
    IPC: "IPC",
    OTHER: "Other",
  };

  const interfaceOrder: InterfaceType[] = [
    "HTTP_API",
    "GRPC_API",
    "GRAPHQL_API",
    "WEBSOCKET",
    "DATABASE",
    "MESSAGE_QUEUE",
    "FILE_STORAGE",
    "EXTERNAL_SERVICE",
    "USER_INTERFACE",
    "NETWORK_PORT",
    "IPC",
    "OTHER",
  ];

  // Exposure matrix heatmap data
  const exposureLabels: Record<NetworkExposure, string> = {
    INTERNET_FACING: "Internet",
    PUBLIC_CLOUD: "Public Cloud",
    PRIVATE_CLOUD: "Private Cloud",
    VPN_PROTECTED: "VPN",
    INTERNAL_ONLY: "Internal",
  };

  const exposureOrder: NetworkExposure[] = [
    "INTERNET_FACING",
    "PUBLIC_CLOUD",
    "PRIVATE_CLOUD",
    "VPN_PROTECTED",
    "INTERNAL_ONLY",
  ];

  const matrixData = useMemo(() => {
    const grid: Record<string, Record<string, ExposureMatrixEntry | null>> = {};
    interfaceOrder.forEach((type) => {
      grid[type] = {};
      exposureOrder.forEach((exp) => {
        grid[type][exp] = null;
      });
    });
    exposureMatrix.forEach((entry) => {
      if (grid[entry.interfaceType]) {
        grid[entry.interfaceType][entry.exposure] = entry;
      }
    });
    return grid;
  }, [exposureMatrix]);

  const getHeatmapColor = (entry: ExposureMatrixEntry | null) => {
    if (!entry || entry.count === 0) return "bg-muted";
    const risk = entry.avgRiskScore;
    if (risk >= 8) return "bg-red-500 text-white";
    if (risk >= 6) return "bg-orange-500 text-white";
    if (risk >= 4) return "bg-yellow-500 text-black";
    if (risk >= 2) return "bg-green-400 text-black";
    return "bg-green-200 text-black";
  };

  return (
    <div className="space-y-6">
      {/* Bar Chart by Interface Type */}
      <div className="p-4 bg-card rounded-lg border">
        <h3 className="text-sm font-semibold mb-4">Interfaces by Type</h3>
        <div className="space-y-2">
          {interfaceOrder
            .filter((type) => interfaceTypeData[type])
            .map((type) => {
              const { count, avgRisk } = interfaceTypeData[type];
              const width = (count / maxCount) * 100;
              return (
                <div key={type} className="flex items-center">
                  <div className="w-24 text-xs font-medium truncate">
                    {interfaceTypeLabels[type]}
                  </div>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        getRiskColor(avgRisk),
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="w-8 text-right text-xs ml-2">{count}</div>
                </div>
              );
            })}
        </div>
        {Object.keys(interfaceTypeData).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No interface data available
          </p>
        )}
      </div>

      {/* Exposure Matrix Heatmap */}
      <div className="p-4 bg-card rounded-lg border">
        <h3 className="text-sm font-semibold mb-4">Exposure Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left p-1"></th>
                {exposureOrder.map((exp) => (
                  <th key={exp} className="text-center p-1 font-medium">
                    {exposureLabels[exp]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {interfaceOrder
                .filter((type) =>
                  exposureOrder.some((exp) => matrixData[type]?.[exp]?.count),
                )
                .map((type) => (
                  <tr key={type}>
                    <td className="p-1 font-medium">
                      {interfaceTypeLabels[type]}
                    </td>
                    {exposureOrder.map((exp) => {
                      const entry = matrixData[type]?.[exp];
                      return (
                        <td key={exp} className="p-1">
                          <div
                            className={cn(
                              "w-full h-8 rounded flex items-center justify-center text-xs font-medium",
                              getHeatmapColor(entry),
                            )}
                            title={
                              entry
                                ? `${entry.count} interfaces, avg risk: ${entry.avgRiskScore.toFixed(1)}`
                                : "No data"
                            }
                          >
                            {entry?.count || ""}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs">
          <span className="text-muted-foreground">Risk:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-200" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-yellow-500" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-orange-500" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span>Critical</span>
          </div>
        </div>
      </div>

      {/* Component Summary */}
      <div className="p-4 bg-card rounded-lg border">
        <h3 className="text-sm font-semibold mb-3">Top Risk Components</h3>
        <div className="space-y-2">
          {components
            .slice()
            .sort((a, b) => b.riskScore - a.riskScore)
            .slice(0, 5)
            .map((comp) => (
              <div
                key={comp.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium truncate">{comp.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {comp.totalInterfaces} interfaces
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium",
                      comp.riskScore >= 8
                        ? "bg-red-100 text-red-700"
                        : comp.riskScore >= 5
                          ? "bg-orange-100 text-orange-700"
                          : "bg-green-100 text-green-700",
                    )}
                  >
                    {comp.riskScore.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
