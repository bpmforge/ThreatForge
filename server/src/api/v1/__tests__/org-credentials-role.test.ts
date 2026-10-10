/**
 * Using the org's stored Jira/GitHub credentials (create issues, sync,
 * analyze a repo) needs EDITOR or above; viewers can still read status.
 */
import { describe, it, expect } from "vitest";
import { canUseOrgCredentials } from "../helpers.js";

describe("canUseOrgCredentials", () => {
  it.each(["OWNER", "ADMIN", "EDITOR"])("allows %s", (role) => {
    expect(canUseOrgCredentials({ hasAccess: true, role })).toBe(true);
  });

  it("refuses VIEWER and non-members", () => {
    expect(canUseOrgCredentials({ hasAccess: true, role: "VIEWER" })).toBe(
      false,
    );
    expect(canUseOrgCredentials(null)).toBe(false);
  });
});
