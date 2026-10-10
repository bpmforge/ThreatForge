/**
 * Version history type definitions
 */

/** Version history entry */
export interface ThreatModelVersion {
  id: string;
  version: number;
  name?: string | null;
  changesSummary?: string | null;
  createdById: string;
  createdBy?: {
    id: string;
    name: string;
  };
  createdAt: string;
}

/** Version with canvas state for preview/restore */
export interface ThreatModelVersionDetail extends ThreatModelVersion {
  canvasState: {
    nodes: unknown[];
    edges: unknown[];
    viewport?: { x: number; y: number; zoom: number };
  };
}

/** Create version request */
export interface CreateVersionRequest {
  name?: string;
  changesSummary?: string;
}

/** Format relative time */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) {
    return date.toLocaleDateString();
  }
  if (days > 0) {
    return days === 1 ? "Yesterday" : `${days} days ago`;
  }
  if (hours > 0) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (minutes > 0) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }
  return "Just now";
}
