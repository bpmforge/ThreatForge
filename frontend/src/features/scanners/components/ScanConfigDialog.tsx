"use client";

import { useState } from "react";
import { useScannerMutations } from "../hooks/useScanners";
import type { ScannerType } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ScanConfigDialogProps {
  projectId: string;
  threatModelId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScanConfigDialog({
  projectId,
  threatModelId,
  open,
  onOpenChange,
}: ScanConfigDialogProps) {
  const [activeScanner, setActiveScanner] = useState<ScannerType>("SNYK");

  // Snyk config
  const [snykProjectId, setSnykProjectId] = useState("");
  const [snykApiKey, setSnykApiKey] = useState("");
  const [snykOrgId, setSnykOrgId] = useState("");

  // SonarQube config
  const [sonarProjectKey, setSonarProjectKey] = useState("");
  const [sonarBaseUrl, setSonarBaseUrl] = useState("");
  const [sonarToken, setSonarToken] = useState("");

  // ZAP config
  const [zapBaseUrl, setZapBaseUrl] = useState("");
  const [zapApiKey, setZapApiKey] = useState("");
  const [zapTargetUrl, setZapTargetUrl] = useState("");

  const {
    runSnykScan,
    isRunningSnyk,
    runSonarScan,
    isRunningSonar,
    importZapScan,
    isImportingZap,
  } = useScannerMutations();

  const isRunning = isRunningSnyk || isRunningSonar || isImportingZap;

  const handleRunScan = () => {
    switch (activeScanner) {
      case "SNYK":
        if (!snykProjectId || !snykApiKey) {
          toast.error("Please fill in required fields");
          return;
        }
        runSnykScan(
          {
            projectId,
            snykProjectId,
            apiKey: snykApiKey,
            orgId: snykOrgId || undefined,
            threatModelId,
          },
          {
            onSuccess: () => {
              toast.success("Snyk scan completed");
              onOpenChange(false);
            },
            onError: (e) => toast.error(e.message),
          },
        );
        break;
      case "SONARQUBE":
        if (!sonarProjectKey || !sonarBaseUrl || !sonarToken) {
          toast.error("Please fill in required fields");
          return;
        }
        runSonarScan(
          {
            projectId,
            sonarProjectKey,
            baseUrl: sonarBaseUrl,
            token: sonarToken,
            threatModelId,
          },
          {
            onSuccess: () => {
              toast.success("SonarQube scan completed");
              onOpenChange(false);
            },
            onError: (e) => toast.error(e.message),
          },
        );
        break;
      case "OWASP_ZAP":
        if (!zapBaseUrl) {
          toast.error("Please fill in required fields");
          return;
        }
        importZapScan(
          {
            projectId,
            baseUrl: zapBaseUrl,
            apiKey: zapApiKey || undefined,
            targetUrl: zapTargetUrl || undefined,
            threatModelId,
          },
          {
            onSuccess: () => {
              toast.success("ZAP scan imported");
              onOpenChange(false);
            },
            onError: (e) => toast.error(e.message),
          },
        );
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Run Security Scan</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeScanner}
          onValueChange={(v) => setActiveScanner(v as ScannerType)}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="SNYK">Snyk</TabsTrigger>
            <TabsTrigger value="SONARQUBE">SonarQube</TabsTrigger>
            <TabsTrigger value="OWASP_ZAP">OWASP ZAP</TabsTrigger>
          </TabsList>

          <TabsContent value="SNYK" className="space-y-3 mt-4">
            <div className="space-y-1">
              <Label htmlFor="snyk-project">Project ID *</Label>
              <Input
                id="snyk-project"
                value={snykProjectId}
                onChange={(e) => setSnykProjectId(e.target.value)}
                placeholder="Snyk project ID"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="snyk-api-key">API Key *</Label>
              <Input
                id="snyk-api-key"
                type="password"
                value={snykApiKey}
                onChange={(e) => setSnykApiKey(e.target.value)}
                placeholder="Snyk API key"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="snyk-org">Organization ID (optional)</Label>
              <Input
                id="snyk-org"
                value={snykOrgId}
                onChange={(e) => setSnykOrgId(e.target.value)}
                placeholder="Snyk org ID"
              />
            </div>
          </TabsContent>

          <TabsContent value="SONARQUBE" className="space-y-3 mt-4">
            <div className="space-y-1">
              <Label htmlFor="sonar-url">Server URL *</Label>
              <Input
                id="sonar-url"
                value={sonarBaseUrl}
                onChange={(e) => setSonarBaseUrl(e.target.value)}
                placeholder="https://sonarqube.example.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sonar-project">Project Key *</Label>
              <Input
                id="sonar-project"
                value={sonarProjectKey}
                onChange={(e) => setSonarProjectKey(e.target.value)}
                placeholder="project-key"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sonar-token">Token *</Label>
              <Input
                id="sonar-token"
                type="password"
                value={sonarToken}
                onChange={(e) => setSonarToken(e.target.value)}
                placeholder="SonarQube token"
              />
            </div>
          </TabsContent>

          <TabsContent value="OWASP_ZAP" className="space-y-3 mt-4">
            <div className="space-y-1">
              <Label htmlFor="zap-url">ZAP API URL *</Label>
              <Input
                id="zap-url"
                value={zapBaseUrl}
                onChange={(e) => setZapBaseUrl(e.target.value)}
                placeholder="http://localhost:8080"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="zap-key">API Key (optional)</Label>
              <Input
                id="zap-key"
                type="password"
                value={zapApiKey}
                onChange={(e) => setZapApiKey(e.target.value)}
                placeholder="ZAP API key"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="zap-target">Target URL (optional)</Label>
              <Input
                id="zap-target"
                value={zapTargetUrl}
                onChange={(e) => setZapTargetUrl(e.target.value)}
                placeholder="https://app.example.com"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRunning}
          >
            Cancel
          </Button>
          <Button onClick={handleRunScan} disabled={isRunning}>
            {isRunning && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {isRunning ? "Running..." : "Run Scan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
