"use client";

import { useState, useEffect } from "react";
import {
  listSites,
  listDrives,
  listFiles,
  fetchFileContent,
  type SharePointConfig,
  type SpSite,
  type SpDrive,
  type SpFile,
} from "../services/api";
import { getErrorMessage } from "@/lib/errors";

interface UseSharePointImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (content: string, filename: string) => void;
}

export type Step = "config" | "sites" | "drives" | "files" | "loading";

export function useSharePointImport({
  open,
  onOpenChange,
  onImport,
}: UseSharePointImportProps) {
  const [step, setStep] = useState<Step>("config");
  const [config, setConfig] = useState<SharePointConfig>({
    tenantId: "",
    clientId: "",
    clientSecret: "",
    hostname: "",
  });
  const [sites, setSites] = useState<SpSite[]>([]);
  const [drives, setDrives] = useState<SpDrive[]>([]);
  const [files, setFiles] = useState<SpFile[]>([]);
  const [selectedSite, setSelectedSite] = useState<SpSite | null>(null);
  const [selectedDrive, setSelectedDrive] = useState<SpDrive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("config");
      setSites([]);
      setDrives([]);
      setFiles([]);
      setSelectedSite(null);
      setSelectedDrive(null);
      setError(null);
    }
  }, [open]);

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(getErrorMessage(e, "An error occurred"));
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = () =>
    withBusy(async () => {
      const d = await listSites(config);
      setSites(d);
      setStep("sites");
    });
  const handleSelectSite = (site: SpSite) =>
    withBusy(async () => {
      setSelectedSite(site);
      const d = await listDrives(config, site.id);
      setDrives(d);
      setStep("drives");
    });
  const handleSelectDrive = (drive: SpDrive) =>
    withBusy(async () => {
      setSelectedDrive(drive);
      const d = await listFiles(config, drive.id);
      setFiles(d);
      setStep("files");
    });
  const handleSelectFile = (file: SpFile) =>
    withBusy(async () => {
      setStep("loading");
      const c = await fetchFileContent(
        config,
        file.driveId,
        file.id,
        file.mimeType,
      );
      onImport(c, file.name);
      onOpenChange(false);
    });

  const handleBack = () => {
    setError(null);
    if (step === "sites") setStep("config");
    else if (step === "drives") setStep("sites");
    else if (step === "files") setStep("drives");
  };

  const canConnect = !!(
    config.tenantId &&
    config.clientId &&
    config.clientSecret &&
    config.hostname
  );

  return {
    step,
    config,
    setConfig,
    sites,
    drives,
    files,
    selectedSite,
    selectedDrive,
    error,
    busy,
    canConnect,
    handleConnect,
    handleSelectSite,
    handleSelectDrive,
    handleSelectFile,
    handleBack,
  };
}
