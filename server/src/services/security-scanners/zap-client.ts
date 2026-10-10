/**
 * OWASP ZAP API Client
 *
 * Client for integrating with OWASP ZAP dynamic application security testing.
 */

import type {
  ScannerFinding,
  ZapAlert,
  ZapScanResult,
  NormalizedSeverity,
} from "./types.js";

interface ZapClientConfig {
  baseUrl: string;
  apiKey?: string;
}

export class ZapClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: ZapClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    if (this.apiKey) {
      url.searchParams.append("apikey", this.apiKey);
    }

    const response = await fetch(url.toString(), { redirect: "manual" });

    if (!response.ok) {
      throw new Error(
        `ZAP API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /** Get scan status */
  async getScanStatus(scanId: string): Promise<{ status: string }> {
    return this.request("/JSON/ascan/view/status/", { scanId });
  }

  /** Start a spider scan */
  async spiderScan(targetUrl: string): Promise<{ scan: string }> {
    return this.request("/JSON/spider/action/scan/", { url: targetUrl });
  }

  /** Start an active scan */
  async activeScan(targetUrl: string): Promise<{ scan: string }> {
    return this.request("/JSON/ascan/action/scan/", { url: targetUrl });
  }

  /** Get alerts (findings) */
  async getAlerts(
    baseUrl?: string,
    start = 0,
    count = 100,
  ): Promise<{ alerts: ZapAlert[] }> {
    const params: Record<string, string> = {
      start: String(start),
      count: String(count),
    };
    if (baseUrl) {
      params.baseurl = baseUrl;
    }
    return this.request("/JSON/alert/view/alerts/", params);
  }

  /** Get all alerts (handles pagination) */
  async getAllAlerts(baseUrl?: string): Promise<ZapAlert[]> {
    const allAlerts: ZapAlert[] = [];
    let start = 0;
    const count = 100;

    while (true) {
      const result = await this.getAlerts(baseUrl, start, count);
      if (!result.alerts || result.alerts.length === 0) {
        break;
      }
      allAlerts.push(...result.alerts);
      if (result.alerts.length < count) {
        break;
      }
      start += count;
    }

    return allAlerts;
  }

  /** Import ZAP scan report (JSON format) */
  importReport(report: ZapScanResult): ZapAlert[] {
    const alerts: ZapAlert[] = [];
    for (const site of report.site) {
      alerts.push(...site.alerts);
    }
    return alerts;
  }

  /** Normalize ZAP risk code to severity */
  private normalizeSeverity(riskcode: string): NormalizedSeverity {
    switch (riskcode) {
      case "3":
        return "CRITICAL";
      case "2":
        return "HIGH";
      case "1":
        return "MEDIUM";
      case "0":
        return "LOW";
      default:
        return "INFO";
    }
  }

  /** Convert ZAP alert to normalized finding */
  normalizeAlert(alert: ZapAlert): ScannerFinding {
    const instances = alert.instances || [];
    const firstInstance = instances[0];

    return {
      externalId: alert.sourceid || `zap-${alert.alert}`,
      scannerType: "OWASP_ZAP",
      title: alert.name || alert.alert,
      description: alert.desc,
      severity: this.normalizeSeverity(alert.riskcode),
      category: "VULNERABILITY",
      cweIds: alert.cweid ? [`CWE-${alert.cweid}`] : [],
      cveIds: [],
      owaspCategory: alert.wascid ? `WASC-${alert.wascid}` : undefined,
      filePath: firstInstance?.uri,
      remediation: alert.solution,
      externalUrl: alert.reference,
      firstSeen: new Date(),
      lastSeen: new Date(),
      rawData: {
        ...alert,
        instanceCount: instances.length,
        affectedUrls: instances.map((i) => i.uri),
      },
    };
  }

  /** Process alerts into normalized findings */
  processAlerts(alerts: ZapAlert[]): ScannerFinding[] {
    // Deduplicate by alert name (ZAP creates one alert per instance)
    const uniqueAlerts = new Map<string, ZapAlert>();
    for (const alert of alerts) {
      const key = alert.alert;
      if (!uniqueAlerts.has(key)) {
        uniqueAlerts.set(key, alert);
      } else {
        // Merge instances
        const existing = uniqueAlerts.get(key)!;
        existing.instances = [
          ...(existing.instances || []),
          ...(alert.instances || []),
        ];
      }
    }

    return Array.from(uniqueAlerts.values()).map((alert) =>
      this.normalizeAlert(alert),
    );
  }
}

/** Create ZAP client from config */
export function createZapClient(baseUrl: string, apiKey?: string): ZapClient {
  return new ZapClient({ baseUrl, apiKey });
}
