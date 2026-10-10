"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TopRiskItem } from "../hooks/usePortfolioDashboard";

interface Props {
  threats: TopRiskItem[];
}

const severityVariant = (severity: string) => {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "destructive";
    case "HIGH":
      return "destructive";
    case "MEDIUM":
      return "secondary";
    default:
      return "outline";
  }
};

const severityClass = (severity: string) => {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "bg-red-600 text-white";
    case "HIGH":
      return "bg-orange-500 text-white";
    case "MEDIUM":
      return "bg-yellow-500 text-black";
    default:
      return "";
  }
};

export function TopUnmitigatedThreats({ threats }: Props) {
  const top = threats.slice(0, 10);

  if (top.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Top Unmitigated Threats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No open threats found.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Top Unmitigated Threats
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                  Threat
                </th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                  Model
                </th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                  Severity
                </th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                  Days Open
                </th>
              </tr>
            </thead>
            <tbody>
              {top.map((t) => (
                <tr
                  key={t.id}
                  className="border-b last:border-0 hover:bg-muted/50"
                >
                  <td className="px-4 py-2 font-medium max-w-[200px] truncate">
                    {t.name}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground max-w-[140px] truncate">
                    {t.modelName}
                  </td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={
                        severityVariant(t.severity) as
                          | "destructive"
                          | "secondary"
                          | "outline"
                      }
                      className={severityClass(t.severity)}
                    >
                      {t.severity}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {t.daysSinceCreated}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
