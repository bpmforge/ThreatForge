"use client";

/**
 * AI Writing Style Tab
 *
 * Per-user writing style preferences for AI-generated threats and mitigations.
 * Each section is independently configurable.
 */
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AIWritingStyleTabProps {
  threatStyleEnabled: boolean;
  onThreatStyleEnabledChange: (enabled: boolean) => void;
  threatStyleTone: string;
  onThreatStyleToneChange: (tone: string) => void;
  threatStyleExamples: string;
  onThreatStyleExamplesChange: (examples: string) => void;
  mitigationStyleEnabled: boolean;
  onMitigationStyleEnabledChange: (enabled: boolean) => void;
  mitigationStyleTone: string;
  onMitigationStyleToneChange: (tone: string) => void;
  mitigationStyleExamples: string;
  onMitigationStyleExamplesChange: (examples: string) => void;
  isSaving: boolean;
  onSave: () => void;
}

const TONE_OPTIONS = [
  {
    value: "formal",
    label: "Formal",
    description: "Professional language with precise technical terminology",
  },
  {
    value: "concise",
    label: "Concise",
    description: "Brief and direct, short sentences, no filler",
  },
  {
    value: "detailed",
    label: "Detailed",
    description: "Thorough explanations with context and attack paths",
  },
  {
    value: "conversational",
    label: "Conversational",
    description: "Approachable language for non-security specialists",
  },
];

function ToneSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TONE_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className="font-medium">{opt.label}</span>
            <span className="text-muted-foreground ml-2 text-xs">
              — {opt.description}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AIWritingStyleTab({
  threatStyleEnabled,
  onThreatStyleEnabledChange,
  threatStyleTone,
  onThreatStyleToneChange,
  threatStyleExamples,
  onThreatStyleExamplesChange,
  mitigationStyleEnabled,
  onMitigationStyleEnabledChange,
  mitigationStyleTone,
  onMitigationStyleToneChange,
  mitigationStyleExamples,
  onMitigationStyleExamplesChange,
  isSaving,
  onSave,
}: AIWritingStyleTabProps) {
  return (
    <div className="space-y-6">
      {/* Threats Style */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Threat Writing Style
          </CardTitle>
          <CardDescription>
            Customize how AI writes threat descriptions and titles. The AI will
            match your preferred tone and style when generating threat analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="threat-style-toggle">
                Enable custom threat style
              </Label>
              <p className="text-xs text-muted-foreground">
                Applies to threat names, descriptions, and analysis output
              </p>
            </div>
            <Switch
              id="threat-style-toggle"
              checked={threatStyleEnabled}
              onCheckedChange={onThreatStyleEnabledChange}
            />
          </div>

          {threatStyleEnabled && (
            <>
              <div className="space-y-2">
                <Label>Tone</Label>
                <ToneSelector
                  value={threatStyleTone}
                  onChange={onThreatStyleToneChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="threat-examples">
                  Threat writing examples (optional)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Paste 2-3 examples of how you write threat descriptions. The
                  AI will match this style.
                </p>
                <Textarea
                  id="threat-examples"
                  value={threatStyleExamples}
                  onChange={(e) => onThreatStyleExamplesChange(e.target.value)}
                  placeholder={`Example: "The API gateway lacks rate limiting on the /auth/token endpoint, enabling credential stuffing attacks against user accounts. An attacker with a leaked credential list could automate login attempts at scale."\n\nExample: "Unauthenticated access to the S3 bucket metadata endpoint exposes internal object keys, allowing an attacker to enumerate sensitive documents."`}
                  rows={5}
                  className="font-mono text-sm"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Mitigations Style */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Mitigation Writing Style
          </CardTitle>
          <CardDescription>
            Customize how AI writes mitigation descriptions and test criteria.
            The AI will match your preferred tone when suggesting security
            controls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="mitigation-style-toggle">
                Enable custom mitigation style
              </Label>
              <p className="text-xs text-muted-foreground">
                Applies to mitigation descriptions, test criteria, and control
                recommendations
              </p>
            </div>
            <Switch
              id="mitigation-style-toggle"
              checked={mitigationStyleEnabled}
              onCheckedChange={onMitigationStyleEnabledChange}
            />
          </div>

          {mitigationStyleEnabled && (
            <>
              <div className="space-y-2">
                <Label>Tone</Label>
                <ToneSelector
                  value={mitigationStyleTone}
                  onChange={onMitigationStyleToneChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mitigation-examples">
                  Mitigation writing examples (optional)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Paste 2-3 examples of how you write mitigations. The AI will
                  match this style.
                </p>
                <Textarea
                  id="mitigation-examples"
                  value={mitigationStyleExamples}
                  onChange={(e) =>
                    onMitigationStyleExamplesChange(e.target.value)
                  }
                  placeholder={`Example: "Implement progressive rate limiting on authentication endpoints — 5 attempts per minute per IP, with exponential backoff after 3 failures."\n\nExample: "Configure TLS 1.3 with certificate pinning on all inter-service communication channels. Rotate certificates every 90 days via automated PKI."`}
                  rows={5}
                  className="font-mono text-sm"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Writing Style
        </Button>
      </div>
    </div>
  );
}
