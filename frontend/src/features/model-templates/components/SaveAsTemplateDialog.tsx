"use client";

/**
 * Save As Template Dialog
 *
 * Allows users to save the current threat model as a reusable template.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, X } from "lucide-react";
import { useSaveAsTemplate } from "../hooks/useModelTemplates";

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
  modelName: string;
}

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  modelId,
  modelName,
}: SaveAsTemplateDialogProps) {
  const saveAsTemplate = useSaveAsTemplate();

  const [name, setName] = useState(modelName ? `${modelName} Template` : "");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [includeThreats, setIncludeThreats] = useState(true);
  const [success, setSuccess] = useState(false);

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;

    saveAsTemplate.mutate(
      {
        modelId,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          tags,
          isPublic,
          includeThreats,
        },
      },
      {
        onSuccess: () => {
          setSuccess(true);
          setTimeout(() => {
            onOpenChange(false);
            resetForm();
          }, 1500);
        },
      },
    );
  };

  const resetForm = () => {
    setName(modelName ? `${modelName} Template` : "");
    setDescription("");
    setCategory("");
    setTags([]);
    setTagInput("");
    setIsPublic(false);
    setIncludeThreats(true);
    setSuccess(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Create a reusable template from this threat model
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-4" />
            <p className="text-lg font-medium">
              Template created successfully!
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tmpl-name">Template Name</Label>
                <Input
                  id="tmpl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., API Gateway Architecture"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tmpl-desc">Description</Label>
                <Textarea
                  id="tmpl-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this template is for..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tmpl-category">Category (optional)</Label>
                <Input
                  id="tmpl-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Web Application, Microservices, Cloud"
                />
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a tag and press Enter"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddTag}
                  >
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label htmlFor="include-threats">Include Threats</Label>
                  <p className="text-sm text-muted-foreground">
                    Copy threats and mitigations to the template
                  </p>
                </div>
                <Switch
                  id="include-threats"
                  checked={includeThreats}
                  onCheckedChange={setIncludeThreats}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="make-public">Make Public</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow others to use this template
                  </p>
                </div>
                <Switch
                  id="make-public"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>

              {isPublic && (
                <Alert>
                  <AlertDescription>
                    Public templates are visible to all users in the
                    marketplace. Make sure it doesn&apos;t contain sensitive
                    information.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveAsTemplate.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveAsTemplate.isPending || !name.trim()}
              >
                {saveAsTemplate.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Template"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
