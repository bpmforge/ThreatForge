"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";

interface PromptUserPromptTabProps {
  value: string;
  isReadOnly: boolean;
  isEditing: boolean;
  onChange: (v: string) => void;
  onOpenPreview: () => void;
}

export function PromptUserPromptTab({
  value,
  isReadOnly,
  isEditing,
  onChange,
  onOpenPreview,
}: PromptUserPromptTabProps) {
  return (
    <TabsContent value="prompts" className="space-y-4">
      <Card className="border-muted bg-muted/30">
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground">
            All prompts use a universal system prompt with security guardrails.
            You can only configure the user prompt section below.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="userPromptTemplate">User Prompt Template</Label>
        <Textarea
          id="userPromptTemplate"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Analyze this document: {{documentText}}"
          rows={12}
          className="font-mono text-sm"
          disabled={isReadOnly}
        />
        <p className="text-xs text-muted-foreground">
          Use {"{{variableName}}"} for dynamic values.
          {isReadOnly && " Clone this prompt to customize it."}
        </p>
      </div>

      {isEditing && (
        <Button variant="outline" onClick={onOpenPreview}>
          <Eye className="h-4 w-4 mr-2" />
          Preview with Variables
        </Button>
      )}
    </TabsContent>
  );
}
