"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PromptLibrary,
  PromptEditor,
  DocumentTypeManager,
  ExecutionLogsViewer,
} from "@/features/prompt-library";

interface OrgAIPromptsTabProps {
  orgId: string;
}

export function OrgAIPromptsTab({ orgId }: OrgAIPromptsTabProps) {
  const [promptsSubTab, setPromptsSubTab] = useState<
    "prompts" | "document-types" | "logs"
  >("prompts");
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5" />
          AI Prompts
        </CardTitle>
        <CardDescription>
          Configure AI prompts for threat modeling and document analysis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={promptsSubTab}
          onValueChange={(v) =>
            setPromptsSubTab(v as "prompts" | "document-types" | "logs")
          }
        >
          <TabsList className="mb-4">
            <TabsTrigger value="prompts">Prompt Library</TabsTrigger>
            <TabsTrigger value="document-types">Document Types</TabsTrigger>
            <TabsTrigger value="logs">Execution Logs</TabsTrigger>
          </TabsList>
          <TabsContent value="prompts">
            {editingPromptId !== null ? (
              <PromptEditor
                orgId={orgId}
                promptId={
                  editingPromptId === "new" ? undefined : editingPromptId
                }
                onSave={() => setEditingPromptId(null)}
                onCancel={() => setEditingPromptId(null)}
              />
            ) : (
              <PromptLibrary
                orgId={orgId}
                onCreatePrompt={() => setEditingPromptId("new")}
                onEditPrompt={(p) => setEditingPromptId(p.id)}
                onSelectPrompt={(p) => setEditingPromptId(p.id)}
              />
            )}
          </TabsContent>
          <TabsContent value="document-types">
            <DocumentTypeManager orgId={orgId} />
          </TabsContent>
          <TabsContent value="logs">
            <ExecutionLogsViewer orgId={orgId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
