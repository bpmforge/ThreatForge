"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Library } from "lucide-react";

interface Subscription {
  id: string;
  libraryId: string;
  library: {
    name: string;
    templateCount: number;
    organization: { name: string };
  };
}

interface MarketplaceSubscriptionsProps {
  subscriptions: Subscription[] | undefined;
}

export function MarketplaceSubscriptions({
  subscriptions,
}: MarketplaceSubscriptionsProps) {
  if (!subscriptions || subscriptions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">My Subscriptions</CardTitle>
        <CardDescription>
          Libraries you&apos;re subscribed to for mitigation templates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                <Library className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{sub.library.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {sub.library.organization.name} ·{" "}
                    {sub.library.templateCount} templates
                  </p>
                </div>
              </div>
              <Badge variant="secondary">Subscribed</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
