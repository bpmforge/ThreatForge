"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Database, Search } from "lucide-react";
import { ExternalSourceCard } from "./ExternalSourceCard";

interface CatalogStats {
  mitre: number;
  cwe: number;
  capec: number;
  total: number;
}

interface ExternalThreatDatabasesCardProps {
  catalogStats: CatalogStats;
  onSearchAll: () => void;
}

export function ExternalThreatDatabasesCard({
  catalogStats,
  onSearchAll,
}: ExternalThreatDatabasesCardProps) {
  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">External Threat Databases</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Search and import threats from industry-standard knowledge bases
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ExternalSourceCard
            name="MITRE ATT&CK"
            description="Adversarial tactics and techniques"
            count={catalogStats.mitre}
            url="https://attack.mitre.org/"
            color="bg-red-500"
          />
          <ExternalSourceCard
            name="CWE"
            description="Common Weakness Enumeration"
            count={catalogStats.cwe}
            url="https://cwe.mitre.org/"
            color="bg-blue-500"
          />
          <ExternalSourceCard
            name="CAPEC"
            description="Common Attack Pattern Enumeration"
            count={catalogStats.capec}
            url="https://capec.mitre.org/"
            color="bg-purple-500"
          />
        </div>
        <Button variant="outline" className="w-full mt-3" onClick={onSearchAll}>
          <Search className="h-4 w-4 mr-2" />
          Search All {catalogStats.total} Threats
        </Button>
      </CardContent>
    </Card>
  );
}
