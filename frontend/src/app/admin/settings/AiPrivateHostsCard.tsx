"use client";

/**
 * Which loopback / private-network hosts organization AI settings may use
 * (self-hosted LLMs). Anything else private is refused, so a tenant cannot
 * point the server's AI calls at the internal network.
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Network } from "lucide-react";
import type { AdminSettings } from "./useAdminSettings";

interface AiPrivateHostsCardProps {
  settings: AdminSettings;
  onUpdate: (updates: Partial<AdminSettings>) => void;
}

export function AiPrivateHostsCard({
  settings,
  onUpdate,
}: AiPrivateHostsCardProps) {
  const envEntries = settings.aiPrivateHostAllowlistFromEnv;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          AI Private Hosts
        </CardTitle>
        <CardDescription>
          Private-network and loopback hosts that organizations may use as an AI
          base URL (self-hosted models). Public AI endpoints need no entry;
          link-local and cloud metadata addresses are always refused.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="aiPrivateHostAllowlist">Allowed private hosts</Label>
          <Textarea
            id="aiPrivateHostAllowlist"
            className="min-h-[100px] font-mono"
            placeholder={"192.168.1.20\n10.0.0.0/24\nlmstudio.lan"}
            value={settings.aiPrivateHostAllowlistText}
            onChange={(e) =>
              onUpdate({ aiPrivateHostAllowlistText: e.target.value })
            }
          />
          <p className="text-sm text-muted-foreground">
            One hostname, IP address or CIDR range per line.
          </p>
        </div>
        {envEntries.length > 0 && (
          <div className="space-y-2">
            <Label>Also allowed by the server environment</Label>
            <div className="flex flex-wrap gap-2">
              {envEntries.map((entry) => (
                <Badge key={entry} variant="secondary" className="font-mono">
                  {entry}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Set with AI_PRIVATE_HOST_ALLOWLIST; change it on the server.
            </p>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="aiAllowAllPrivateHosts">
              Allow all private hosts
            </Label>
            <p className="text-sm text-muted-foreground">
              Only for a single-tenant, self-hosted install where every user is
              trusted with the internal network.
              {settings.aiAllowAllPrivateHostsFromEnv &&
                " Already on via AI_ALLOW_ALL_PRIVATE_HOSTS on the server."}
            </p>
          </div>
          <Switch
            id="aiAllowAllPrivateHosts"
            checked={settings.aiAllowAllPrivateHosts}
            onCheckedChange={(checked) =>
              onUpdate({ aiAllowAllPrivateHosts: checked })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
