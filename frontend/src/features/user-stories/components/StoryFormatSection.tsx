"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface StoryFormatSectionProps {
  asA: string;
  iWant: string;
  soThat: string;
  onAsAChange: (v: string) => void;
  onIWantChange: (v: string) => void;
  onSoThatChange: (v: string) => void;
}

export function StoryFormatSection({
  asA,
  iWant,
  soThat,
  onAsAChange,
  onIWantChange,
  onSoThatChange,
}: StoryFormatSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-muted-foreground">
        User Story Format
      </h4>
      <div className="space-y-2">
        <Label htmlFor="asA">
          <span className="text-primary font-semibold">As a</span>
        </Label>
        <Input
          id="asA"
          value={asA}
          onChange={(e) => onAsAChange(e.target.value)}
          placeholder="e.g., system administrator"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="iWant">
          <span className="text-primary font-semibold">I want</span>
        </Label>
        <Textarea
          id="iWant"
          value={iWant}
          onChange={(e) => onIWantChange(e.target.value)}
          placeholder="e.g., to configure user permissions"
          rows={2}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="soThat">
          <span className="text-primary font-semibold">So that</span>
        </Label>
        <Textarea
          id="soThat"
          value={soThat}
          onChange={(e) => onSoThatChange(e.target.value)}
          placeholder="e.g., I can control access to sensitive features"
          rows={2}
          required
        />
      </div>
    </div>
  );
}
