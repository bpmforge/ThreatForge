"use client";

/**
 * Compliance Analytics Page
 *
 * Gap analysis and coverage tracking for compliance frameworks.
 */
import { useState } from "react";
import { AppHeader } from "@/components/layout";
import { CompliancePanel } from "@/features/compliance";
import { useThreatModels } from "@/features/dashboard";
import { useOrganizations } from "@/features/organizations/hooks/useOrganization";
import { useCurrentOrgId } from "@/stores/org-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardCheck } from "lucide-react";

export default function CompliancePage() {
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const { data: models } = useThreatModels();
  const orgId = useCurrentOrgId();
  const { data: orgs } = useOrganizations();
  const selectedModel = models?.find((m) => m.id === selectedModelId);
  const orgName = orgs?.find((o) => o.id === orgId)?.name ?? "Organization";

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Compliance Analysis
            </h1>
            <p className="text-muted-foreground text-sm">
              Track compliance coverage across SOC 2, ISO 27001, NIST, HIPAA,
              PCI DSS, and more.
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
                <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                Select a threat model to analyze compliance coverage.
              </p>
            </div>
          ) : (
            <CompliancePanel
              modelId={selectedModelId}
              modelName={selectedModel?.name}
              orgName={orgName}
            />
          )}
        </div>
      </main>
    </>
  );
}
