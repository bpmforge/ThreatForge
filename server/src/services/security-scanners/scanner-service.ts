/**
 * Security Scanner Service
 *
 * Main service for managing scanner integrations and processing findings.
 */

import { getPrisma } from "../../db.js";
import type {
  ScannerType,
  ScannerFinding,
  ScanRun,
  FindingComponentMapping,
  NormalizedSeverity,
} from "./types.js";
import { createSnykClient } from "./snyk-client.js";
import { createSonarQubeClient } from "./sonarqube-client.js";
import { createZapClient } from "./zap-client.js";

// CWE to component type mapping for auto-association
const CWE_COMPONENT_MAPPING: Record<string, string[]> = {
  // SQL Injection
  "CWE-89": ["database", "data-store", "api"],
  // XSS
  "CWE-79": ["web-app", "frontend", "api"],
  // Authentication
  "CWE-287": ["auth-service", "identity-provider", "api"],
  "CWE-306": ["auth-service", "api", "gateway"],
  // Authorization
  "CWE-285": ["api", "service", "gateway"],
  "CWE-639": ["api", "service"],
  // Cryptography
  "CWE-327": ["crypto-service", "auth-service", "service"],
  "CWE-328": ["crypto-service", "auth-service"],
  // Injection
  "CWE-78": ["service", "container", "server"],
  "CWE-94": ["service", "container"],
  // Path traversal
  "CWE-22": ["file-storage", "api", "service"],
  // SSRF
  "CWE-918": ["api", "service", "integration"],
  // XXE
  "CWE-611": ["api", "service"],
  // Deserialization
  "CWE-502": ["api", "service", "queue"],
  // Open redirect
  "CWE-601": ["web-app", "api", "gateway"],
  // CSRF
  "CWE-352": ["web-app", "api"],
  // Secrets
  "CWE-798": ["any"],
  "CWE-540": ["any"],
  // Container/K8s
  "CWE-250": ["container", "kubernetes", "pod"],
  "CWE-269": ["container", "kubernetes", "service"],
  // Dependencies
  "CWE-1395": ["dependency", "library", "container"],
};

/** Map scanner findings to threat model components */
export async function mapFindingsToComponents(
  threatModelId: string,
  findings: ScannerFinding[],
): Promise<FindingComponentMapping[]> {
  const prisma = await getPrisma();

  // Get all components from the threat model's canvas state
  const model = await prisma.threatModel.findUnique({
    where: { id: threatModelId },
  });

  if (!model || !model.canvasState) {
    return [];
  }

  let canvasState: {
    nodes?: {
      id: string;
      data?: { type?: string; label?: string; name?: string };
    }[];
  };
  try {
    canvasState =
      typeof model.canvasState === "string"
        ? JSON.parse(model.canvasState)
        : (model.canvasState as {
            nodes?: {
              id: string;
              data?: { type?: string; label?: string; name?: string };
            }[];
          });
  } catch {
    return [];
  }

  const components = canvasState.nodes || [];
  const mappings: FindingComponentMapping[] = [];

  for (const finding of findings) {
    // Try to match by CWE
    for (const cweId of finding.cweIds) {
      const normalizedCwe = cweId.replace("CWE-", "");
      const matchingTypes = CWE_COMPONENT_MAPPING[`CWE-${normalizedCwe}`] || [];

      for (const component of components) {
        const componentType = (component.data?.type || "").toLowerCase();
        const componentName = (
          component.data?.label ||
          component.data?.name ||
          ""
        ).toLowerCase();

        // Check if component type matches
        if (
          matchingTypes.includes("any") ||
          matchingTypes.some((t) => componentType.includes(t))
        ) {
          mappings.push({
            findingId: finding.externalId,
            componentId: component.id,
            confidence: "MEDIUM",
            mappingReason: `CWE ${normalizedCwe} typically affects ${componentType} components`,
          });
          break;
        }

        // Check by file path matching component name
        if (
          finding.filePath &&
          componentName &&
          finding.filePath.toLowerCase().includes(componentName)
        ) {
          mappings.push({
            findingId: finding.externalId,
            componentId: component.id,
            confidence: "HIGH",
            mappingReason: `File path "${finding.filePath}" matches component "${componentName}"`,
          });
          break;
        }

        // Check by package name matching component
        if (
          finding.componentName &&
          componentName &&
          (finding.componentName.toLowerCase().includes(componentName) ||
            componentName.includes(finding.componentName.toLowerCase()))
        ) {
          mappings.push({
            findingId: finding.externalId,
            componentId: component.id,
            confidence: "HIGH",
            mappingReason: `Package "${finding.componentName}" matches component "${componentName}"`,
          });
          break;
        }
      }
    }
  }

  // Deduplicate mappings
  const seen = new Set<string>();
  return mappings.filter((m) => {
    const key = `${m.findingId}-${m.componentId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Persist scan results to database */
export async function persistScanResults(
  projectId: string,
  threatModelId: string | undefined,
  scannerType: ScannerType,
  findings: ScannerFinding[],
): Promise<ScanRun> {
  const prisma = await getPrisma();

  // Count by severity
  const counts = findings.reduce(
    (acc, f) => {
      acc[f.severity.toLowerCase() as keyof typeof acc]++;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  );

  // Create scan run record
  const scanRun = await prisma.scanRun.create({
    data: {
      scannerType,
      projectId,
      threatModelId,
      startedAt: new Date(),
      completedAt: new Date(),
      status: "COMPLETED",
      totalFindings: findings.length,
      criticalCount: counts.critical,
      highCount: counts.high,
      mediumCount: counts.medium,
      lowCount: counts.low,
      infoCount: counts.info,
    },
  });

  // Create finding records
  for (const finding of findings) {
    await prisma.scannerFinding.upsert({
      where: {
        projectId_scannerType_externalId: {
          projectId,
          scannerType,
          externalId: finding.externalId,
        },
      },
      update: {
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        category: finding.category,
        cweIds: JSON.stringify(finding.cweIds),
        cveIds: JSON.stringify(finding.cveIds),
        owaspCategory: finding.owaspCategory,
        filePath: finding.filePath,
        lineNumber: finding.lineNumber,
        componentName: finding.componentName,
        componentVersion: finding.componentVersion,
        fixAvailable: finding.fixAvailable,
        fixVersion: finding.fixVersion,
        remediation: finding.remediation,
        externalUrl: finding.externalUrl,
        lastSeen: finding.lastSeen,
        rawData: finding.rawData ? JSON.stringify(finding.rawData) : null,
        scanRunId: scanRun.id,
      },
      create: {
        externalId: finding.externalId,
        scannerType,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        category: finding.category,
        cweIds: JSON.stringify(finding.cweIds),
        cveIds: JSON.stringify(finding.cveIds),
        owaspCategory: finding.owaspCategory,
        filePath: finding.filePath,
        lineNumber: finding.lineNumber,
        componentName: finding.componentName,
        componentVersion: finding.componentVersion,
        fixAvailable: finding.fixAvailable,
        fixVersion: finding.fixVersion,
        remediation: finding.remediation,
        externalUrl: finding.externalUrl,
        firstSeen: finding.firstSeen,
        lastSeen: finding.lastSeen,
        rawData: finding.rawData ? JSON.stringify(finding.rawData) : null,
        scanRunId: scanRun.id,
        projectId,
        threatModelId,
      },
    });
  }

  return scanRun as unknown as ScanRun;
}

/** Run Snyk scan for a project */
export async function runSnykScan(
  projectId: string,
  snykProjectId: string,
  apiKey: string,
  orgId?: string,
): Promise<ScannerFinding[]> {
  const client = createSnykClient(apiKey, orgId);
  const result = await client.getProjectIssues(snykProjectId);
  return client.processTestResult(result);
}

/** Run SonarQube scan for a project */
export async function runSonarQubeScan(
  projectId: string,
  sonarProjectKey: string,
  baseUrl: string,
  token: string,
): Promise<ScannerFinding[]> {
  const client = createSonarQubeClient(baseUrl, token);
  const issues = await client.getAllProjectIssues(sonarProjectKey, [
    "VULNERABILITY",
    "SECURITY_HOTSPOT",
  ]);
  return client.processIssues(issues);
}

/** Import ZAP scan results */
export async function importZapScan(
  projectId: string,
  baseUrl: string,
  apiKey?: string,
  targetUrl?: string,
): Promise<ScannerFinding[]> {
  const client = createZapClient(baseUrl, apiKey);
  const alerts = await client.getAllAlerts(targetUrl);
  return client.processAlerts(alerts);
}

/** Get findings for a project */
export async function getProjectFindings(
  projectId: string,
  filters?: {
    scannerType?: ScannerType;
    severity?: NormalizedSeverity[];
    status?: string;
  },
): Promise<ScannerFinding[]> {
  const prisma = await getPrisma();

  const where: Record<string, unknown> = { projectId };

  if (filters?.scannerType) {
    where.scannerType = filters.scannerType;
  }
  if (filters?.severity?.length) {
    where.severity = { in: filters.severity };
  }
  if (filters?.status) {
    where.status = filters.status;
  }

  const findings = await prisma.scannerFinding.findMany({
    where,
    orderBy: [{ severity: "asc" }, { lastSeen: "desc" }],
  });

  return findings.map((f) => ({
    externalId: f.externalId,
    scannerType: f.scannerType as ScannerType,
    title: f.title,
    description: f.description,
    severity: f.severity as NormalizedSeverity,
    category: f.category as ScannerFinding["category"],
    cweIds: JSON.parse(f.cweIds || "[]"),
    cveIds: JSON.parse(f.cveIds || "[]"),
    owaspCategory: f.owaspCategory || undefined,
    filePath: f.filePath || undefined,
    lineNumber: f.lineNumber || undefined,
    componentName: f.componentName || undefined,
    componentVersion: f.componentVersion || undefined,
    fixAvailable: f.fixAvailable || undefined,
    fixVersion: f.fixVersion || undefined,
    remediation: f.remediation || undefined,
    externalUrl: f.externalUrl || undefined,
    firstSeen: f.firstSeen,
    lastSeen: f.lastSeen,
    rawData: f.rawData ? JSON.parse(f.rawData) : undefined,
  }));
}

/** Get scan history for a project */
export async function getScanHistory(projectId: string): Promise<ScanRun[]> {
  const prisma = await getPrisma();

  const runs = await prisma.scanRun.findMany({
    where: { projectId },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return runs as unknown as ScanRun[];
}

/** Get finding statistics */
export async function getFindingStats(projectId: string): Promise<{
  total: number;
  bySeverity: Record<NormalizedSeverity, number>;
  byScanner: Record<ScannerType, number>;
  trend: { date: string; count: number }[];
}> {
  const prisma = await getPrisma();

  const findings = await prisma.scannerFinding.findMany({
    where: { projectId },
    select: {
      severity: true,
      scannerType: true,
      firstSeen: true,
    },
  });

  const bySeverity: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };

  const byScanner: Record<string, number> = {};

  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byScanner[f.scannerType] = (byScanner[f.scannerType] || 0) + 1;
  }

  // Calculate trend (findings per day for last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const trend: Record<string, number> = {};
  for (const f of findings) {
    if (f.firstSeen >= thirtyDaysAgo) {
      const dateKey = f.firstSeen.toISOString().split("T")[0];
      trend[dateKey] = (trend[dateKey] || 0) + 1;
    }
  }

  return {
    total: findings.length,
    bySeverity: bySeverity as Record<NormalizedSeverity, number>,
    byScanner: byScanner as Record<ScannerType, number>,
    trend: Object.entries(trend)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
