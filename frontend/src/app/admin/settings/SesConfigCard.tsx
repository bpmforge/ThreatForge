"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SesConfigCardProps {
  sesConfig: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
  onChange: (updates: Partial<SesConfigCardProps["sesConfig"]>) => void;
}

export function SesConfigCard({ sesConfig, onChange }: SesConfigCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AWS SES Configuration</CardTitle>
        <CardDescription>
          Configure Amazon Simple Email Service credentials
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sesAccessKey">Access Key ID</Label>
            <Input
              id="sesAccessKey"
              placeholder="AKIA..."
              value={sesConfig.accessKeyId}
              onChange={(e) => onChange({ accessKeyId: e.target.value })}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sesRegion">Region</Label>
            <Select
              value={sesConfig.region}
              onValueChange={(v) => onChange({ region: v })}
            >
              <SelectTrigger id="sesRegion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                <SelectItem value="ap-southeast-1">
                  Asia Pacific (Singapore)
                </SelectItem>
                <SelectItem value="ap-northeast-1">
                  Asia Pacific (Tokyo)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sesSecretKey">Secret Access Key</Label>
          <Input
            id="sesSecretKey"
            type="password"
            placeholder="Enter your secret access key"
            value={sesConfig.secretAccessKey}
            onChange={(e) => onChange({ secretAccessKey: e.target.value })}
            className="font-mono"
          />
        </div>
      </CardContent>
    </Card>
  );
}
