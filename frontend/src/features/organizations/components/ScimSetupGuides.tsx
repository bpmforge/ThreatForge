"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ScimSetupGuides() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Setup Guides</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <details className="group">
          <summary className="cursor-pointer font-medium select-none">
            Okta
          </summary>
          <ol className="mt-2 ml-4 space-y-1 text-muted-foreground list-decimal">
            <li>
              Go to <strong>Okta Admin → Applications → Add Application</strong>
            </li>
            <li>
              Search for{" "}
              <strong>&quot;SCIM 2.0 Test App (Header Auth)&quot;</strong>
            </li>
            <li>
              Set <strong>SCIM connector base URL</strong> to the Base URL above
            </li>
            <li>
              Authentication mode: <strong>HTTP Header</strong>
            </li>
            <li>
              Authorization: <strong>Bearer &lt;your-token&gt;</strong>
            </li>
            <li>
              Enable provisioning actions: Push New Users, Push Profile Updates,
              Push Groups, Deactivate Users
            </li>
            <li>
              Click <strong>&quot;Test API Credentials&quot;</strong> — expects
              200 OK
            </li>
            <li>Assign the app to user groups to start provisioning</li>
          </ol>
        </details>

        <details className="group">
          <summary className="cursor-pointer font-medium select-none">
            Microsoft Azure AD / Entra ID
          </summary>
          <ol className="mt-2 ml-4 space-y-1 text-muted-foreground list-decimal">
            <li>
              Go to{" "}
              <strong>
                Azure AD → Enterprise Applications → New Application
              </strong>
            </li>
            <li>
              Choose <strong>&quot;Non-gallery application&quot;</strong>
            </li>
            <li>
              Open the <strong>Provisioning</strong> tab → set mode to{" "}
              <strong>Automatic</strong>
            </li>
            <li>
              <strong>Tenant URL:</strong> paste the Base URL above
            </li>
            <li>
              <strong>Secret Token:</strong> paste your SCIM bearer token
            </li>
            <li>
              Click <strong>&quot;Test Connection&quot;</strong>
            </li>
            <li>
              Map attributes: <code>userPrincipalName → userName</code>,{" "}
              <code>givenName / surname → name.*</code>
            </li>
            <li>
              Save and set <strong>Provisioning Status</strong> to On
            </li>
          </ol>
        </details>
      </CardContent>
    </Card>
  );
}
