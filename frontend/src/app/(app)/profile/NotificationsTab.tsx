"use client";

/**
 * Notifications Tab
 *
 * Email notification preferences.
 */
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface NotificationsTabProps {
  emailNotifications: boolean;
  onEmailNotificationsChange: (value: boolean) => void;
  modelUpdates: boolean;
  onModelUpdatesChange: (value: boolean) => void;
  threatAlerts: boolean;
  onThreatAlertsChange: (value: boolean) => void;
  onSave: () => void;
}

export function NotificationsTab({
  emailNotifications,
  onEmailNotificationsChange,
  modelUpdates,
  onModelUpdatesChange,
  threatAlerts,
  onThreatAlertsChange,
  onSave,
}: NotificationsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Notifications</CardTitle>
        <CardDescription>
          Choose what notifications you want to receive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Email Notifications</p>
            <p className="text-sm text-muted-foreground">
              Receive email notifications for important updates.
            </p>
          </div>
          <Switch
            checked={emailNotifications}
            onCheckedChange={onEmailNotificationsChange}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Model Updates</p>
            <p className="text-sm text-muted-foreground">
              Get notified when models you&apos;re assigned to are updated.
            </p>
          </div>
          <Switch
            checked={modelUpdates}
            onCheckedChange={onModelUpdatesChange}
            disabled={!emailNotifications}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Threat Alerts</p>
            <p className="text-sm text-muted-foreground">
              Receive alerts for new or critical threats.
            </p>
          </div>
          <Switch
            checked={threatAlerts}
            onCheckedChange={onThreatAlertsChange}
            disabled={!emailNotifications}
          />
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button onClick={onSave}>Save Preferences</Button>
        </div>
      </CardContent>
    </Card>
  );
}
