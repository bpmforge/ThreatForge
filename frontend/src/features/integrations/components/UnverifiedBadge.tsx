/**
 * "Unverified" marker for integrations that have never been exercised
 * against a live instance of the external service.
 */
import { Badge } from "@/components/ui/badge";
import type { IntegrationType } from "../types";

/** Why each unverified integration is flagged. Remove an entry once tested end to end. */
export const UNVERIFIED_INTEGRATIONS: Partial<Record<IntegrationType, string>> =
  {
    JIRA: "Not yet tested against a live Jira instance. Webhook deliveries must be signed with this organization's CI webhook secret.",
  };

export function UnverifiedBadge({ type }: { type: IntegrationType }) {
  const reason = UNVERIFIED_INTEGRATIONS[type];
  if (!reason) return null;
  return (
    <Badge
      variant="outline"
      className="text-xs"
      title={reason}
      aria-label={`Unverified: ${reason}`}
    >
      Unverified
    </Badge>
  );
}
