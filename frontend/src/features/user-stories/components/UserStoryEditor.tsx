/**
 * User Story Editor
 *
 * Form for creating/editing user stories with the "As a... I want... So that..."
 * format and acceptance criteria.
 */
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, X, Link2 } from "lucide-react";
import { useUserStoryForm } from "../hooks/useUserStoryForm";
import { AcceptanceCriteriaSection } from "./AcceptanceCriteriaSection";
import { StoryTagsSection } from "./StoryTagsSection";
import { StoryFormatSection } from "./StoryFormatSection";
import type { UserStoryStatus } from "../types";

interface Props {
  projectId: string;
  storyId?: string;
  onClose: () => void;
  onSaved?: (storyId: string) => void;
  className?: string;
}

const STATUS_OPTIONS: { value: UserStoryStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "READY", label: "Ready" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "DONE", label: "Done" },
];

export function UserStoryEditor({
  projectId,
  storyId,
  onClose,
  onSaved,
  className,
}: Props) {
  const {
    isEditing,
    existingStory,
    title,
    setTitle,
    asA,
    setAsA,
    iWant,
    setIWant,
    soThat,
    setSoThat,
    acceptanceCriteria,
    status,
    setStatus,
    tags,
    externalId,
    setExternalId,
    newCriterion,
    setNewCriterion,
    newTag,
    setNewTag,
    handleSubmit,
    addCriterion,
    removeCriterion,
    addTag,
    removeTag,
    isValid,
    isPending,
  } = useUserStoryForm(projectId, storyId, onClose, onSaved);

  return (
    <div className={className}>
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">
          {isEditing ? "Edit User Story" : "New User Story"}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short descriptive title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as UserStoryStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />
          <StoryFormatSection
            asA={asA}
            iWant={iWant}
            soThat={soThat}
            onAsAChange={setAsA}
            onIWantChange={setIWant}
            onSoThatChange={setSoThat}
          />

          <Separator />
          <AcceptanceCriteriaSection
            criteria={acceptanceCriteria}
            newCriterion={newCriterion}
            onNewCriterionChange={setNewCriterion}
            onAdd={addCriterion}
            onRemove={removeCriterion}
          />

          <Separator />
          <StoryTagsSection
            tags={tags}
            newTag={newTag}
            onNewTagChange={setNewTag}
            onAdd={addTag}
            onRemove={removeTag}
          />

          <Separator />
          <div className="space-y-2">
            <Label htmlFor="externalId">External ID (optional)</Label>
            <Input
              id="externalId"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="e.g., JIRA-123"
            />
            <p className="text-xs text-muted-foreground">
              Link to an external tracking system
            </p>
          </div>

          {isEditing && existingStory && existingStory.dataFlows.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Linked Data Flows
                </h4>
                <div className="space-y-1">
                  {existingStory.dataFlows.map((flow) => (
                    <div
                      key={flow.id}
                      className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm"
                    >
                      <span className="font-mono text-muted-foreground">
                        {flow.number ?? "-"}
                      </span>
                      <span>{flow.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isPending}>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? "Save Changes" : "Create Story"}
            </Button>
          </div>
        </form>
      </ScrollArea>
    </div>
  );
}
