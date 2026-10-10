/**
 * SharePoint Integration API Service
 *
 * Uses Microsoft Graph API to browse and fetch documents from SharePoint.
 *
 * Prerequisites (Azure App Registration):
 * - Register an app in Azure AD with Sites.Read.All permission
 * - Copy Tenant ID, Client ID, Client Secret to integration settings
 *
 * Token endpoint: POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
 * Graph base: https://graph.microsoft.com/v1.0
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export interface SharePointConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** e.g. "yourcompany.sharepoint.com" */
  hostname: string;
}

export interface SpSite {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
}

export interface SpDrive {
  id: string;
  name: string;
  webUrl: string;
}

export interface SpFile {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  lastModifiedDateTime: string;
  mimeType: string;
  driveId: string;
}

/** Obtain an app-only access token via client-credentials flow. */
async function getAccessToken(config: SharePointConfig): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  // Raw fetch: external Microsoft login endpoint, not our API.
  const res = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );
  if (!res.ok) throw new Error(`SharePoint auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function graphGet<T>(token: string, path: string): Promise<T> {
  // Raw fetch: external Microsoft Graph URL, not our API.
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(err.error?.message ?? `Graph API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** List all sites on the tenant matching the configured hostname. */
export async function listSites(config: SharePointConfig): Promise<SpSite[]> {
  const token = await getAccessToken(config);
  const data = await graphGet<{ value: SpSite[] }>(
    token,
    `/sites?search=*&$filter=siteCollection/hostname eq '${config.hostname}'`,
  );
  return data.value;
}

/** List document libraries (drives) in a site. */
export async function listDrives(
  config: SharePointConfig,
  siteId: string,
): Promise<SpDrive[]> {
  const token = await getAccessToken(config);
  const data = await graphGet<{ value: SpDrive[] }>(
    token,
    `/sites/${siteId}/drives`,
  );
  return data.value;
}

/** List files in the root of a drive (or a sub-folder by itemId). */
export async function listFiles(
  config: SharePointConfig,
  driveId: string,
  folderId?: string,
): Promise<SpFile[]> {
  const token = await getAccessToken(config);
  const path = folderId
    ? `/drives/${driveId}/items/${folderId}/children`
    : `/drives/${driveId}/root/children`;
  const data = await graphGet<{
    value: Array<{
      id: string;
      name: string;
      webUrl: string;
      size: number;
      lastModifiedDateTime: string;
      file?: { mimeType: string };
      folder?: object;
    }>;
  }>(token, path);

  return data.value
    .filter((item) => item.file) // exclude folders
    .map((item) => ({
      id: item.id,
      name: item.name,
      webUrl: item.webUrl,
      size: item.size,
      lastModifiedDateTime: item.lastModifiedDateTime,
      mimeType: item.file!.mimeType,
      driveId,
    }));
}

/** Download a file and return its text content (for .txt, .md, .docx via Graph conversion). */
export async function fetchFileContent(
  config: SharePointConfig,
  driveId: string,
  fileId: string,
  mimeType: string,
): Promise<string> {
  const token = await getAccessToken(config);

  // For Office documents, request plain-text conversion
  const isOffice =
    mimeType.includes("word") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("presentation") ||
    mimeType.includes("officedocument");

  const contentPath = isOffice
    ? `/drives/${driveId}/items/${fileId}/content?format=text`
    : `/drives/${driveId}/items/${fileId}/content`;

  // Raw fetch: external Microsoft Graph URL, not our API.
  const res = await fetch(`${GRAPH_BASE}${contentPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
  return res.text();
}
