"use client";

/**
 * Attack Surface Analytics Page
 *
 * Maps exposed interfaces and entry points for a selected model.
 */
import { useState } from "react";
import { AppHeader } from "@/components/layout";
import { AttackSurfacePanel } from "@/features/attack-surface";
import { useThreatModels } from "@/features/dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScanSearch } from "lucide-react";

export default function AttackSurfacePage() {
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const { data: models } = useThreatModels();

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Attack Surface Analysis
            </h1>
            <p className="text-muted-foreground text-sm">
              Map exposed interfaces, entry points, and external-facing
              components.
            </p>
          </div>

          <Select value={selectedModelId} onValueChange={setSelectedModelId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a threat model" />
            </SelectTrigger>
            <SelectContent>
              {models?.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!selectedModelId ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <ScanSearch className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                Select a threat model to analyze its attack surface.
              </p>
            </div>
          ) : (
            <AttackSurfacePanel modelId={selectedModelId} />
          )}
        </div>
      </main>
    </>
  );
}
