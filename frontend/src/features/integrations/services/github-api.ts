import { apiPost } from "@/lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export async function testGitHubConnection(
  orgId: string,
): Promise<{ success: boolean; repo?: string; message: string }> {
  return apiPost(
    `${API_BASE}/api/v1/organizations/${orgId}/integrations/github/test`,
    {},
  );
}
