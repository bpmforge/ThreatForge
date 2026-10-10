"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { useVersion } from "../hooks/useVersionHistory";
import { useThreats } from "@/features/threats/hooks/useThreats";
import type { ThreatModelVersion } from "../types";
import { compareVersions } from "../utils/compareVersions";
import { VersionDiffView } from "./VersionDiffView";

interface Props {
  modelId: string;
  versions: ThreatModelVersion[];
  baseVersionId: string | null;
  compareVersionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBaseVersionChange: (id: string) => void;
  onCompareVersionChange: (id: string) => void;
}

export function VersionCompareDialog({
  modelId,
  versions,
  baseVersionId,
  compareVersionId,
  open,
  onOpenChange,
  onBaseVersionChange,
  onCompareVersionChange,
}: Props) {
  const { data: baseVersion, isLoading: baseLoading } = useVersion(
    modelId,
    baseVersionId,
  );
  const { data: compareVersion, isLoading: compareLoading } = useVersion(
    modelId,
    compareVersionId,
  );

  const diff = useMemo(
    () => compareVersions(baseVersion, compareVersion),
    [baseVersion, compareVersion],
  );

  const [activeTab, setActiveTab] = useState<"canvas" | "threats">("canvas");
  const { data: threats = [] } = useThreats(modelId);

  const isLoading = baseLoading || compareLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Compare Versions</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">
              Base Version
            </label>
            <Select
              value={baseVersionId || ""}
              onValueChange={onBaseVersionChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select base version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem
                    key={v.id}
                    value={v.id}
                    disabled={v.id === compareVersionId}
                  >
                    {v.name || `Version ${v.version}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-5" />
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">
              Compare Version
            </label>
            <Select
              value={compareVersionId || ""}
              onValueChange={onCompareVersionChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select compare version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem
                    key={v.id}
                    value={v.id}
                    disabled={v.id === baseVersionId}
                  >
                    {v.name || `Version ${v.version}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "canvas" | "threats")}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="w-full">
            <TabsTrigger value="canvas" className="flex-1">
              Canvas Changes
            </TabsTrigger>
            <TabsTrigger value="threats" className="flex-1">
              Threats
              {threats.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {threats.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="threats" className="mt-0 flex-1">
            <ScrollArea className="h-[380px]">
              {threats.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No threats in this model.
                </div>
              ) : (
                <div className="space-y-1 p-1">
                  {threats.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 p-2 rounded border text-sm"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                      <span className="flex-1 font-medium truncate">
                        {t.name}
                      </span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {t.severity}
                      </Badge>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {t.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="canvas" className="mt-0 flex-1">
            <VersionDiffView
              isLoading={isLoading}
              baseVersionId={baseVersionId}
              compareVersionId={compareVersionId}
              diff={diff}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
