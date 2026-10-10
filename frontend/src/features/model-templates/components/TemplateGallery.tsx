"use client";

/**
 * Template Gallery
 *
 * Browse and create models from templates.
 */
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search,
  FileCode,
  Building2,
  Download,
  Loader2,
  User,
  Globe,
  Lock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  useModelTemplates,
  useTemplateCategories,
  useCreateFromTemplate,
} from "../hooks/useModelTemplates";
import type { ModelTemplate } from "../types";

interface TemplateGalleryProps {
  projectId: string;
  onModelCreated?: (modelId: string) => void;
}

export function TemplateGallery({
  projectId,
  onModelCreated,
}: TemplateGalleryProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("__all__");
  const [selectedTemplate, setSelectedTemplate] =
    useState<ModelTemplate | null>(null);
  const [newModelName, setNewModelName] = useState("");

  const { data: templatesData, isLoading } = useModelTemplates({
    search: search || undefined,
    category: category === "__all__" ? undefined : category,
  });
  const { data: categories } = useTemplateCategories();
  const createFromTemplate = useCreateFromTemplate();

  const handleCreateFromTemplate = () => {
    if (!selectedTemplate || !newModelName.trim()) return;

    createFromTemplate.mutate(
      {
        templateId: selectedTemplate.id,
        data: {
          projectId,
          name: newModelName.trim(),
        },
      },
      {
        onSuccess: (result) => {
          setSelectedTemplate(null);
          setNewModelName("");
          onModelCreated?.(result.id);
        },
      },
    );
  };

  const handleSelectTemplate = (template: ModelTemplate) => {
    setSelectedTemplate(template);
    setNewModelName(`${template.name} Copy`);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {categories?.map((cat) => (
                <SelectItem key={cat.name} value={cat.name}>
                  {cat.name} ({cat.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : templatesData?.data && templatesData.data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templatesData.data.map((template) => (
              <Card
                key={template.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleSelectTemplate(template)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">
                        {template.name}
                      </CardTitle>
                    </div>
                    {template.isPublic ? (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  {template.organization && (
                    <CardDescription className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {template.organization.name}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {template.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {template.description}
                    </p>
                  )}

                  {template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {template.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {template.usageCount} uses
                    </span>
                    <span>
                      {formatDistanceToNow(new Date(template.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <FileCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {search || category
                  ? "No templates match your search"
                  : "No templates available yet"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create From Template Dialog */}
      <Dialog
        open={!!selectedTemplate}
        onOpenChange={() => setSelectedTemplate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create from Template</DialogTitle>
            <DialogDescription>
              Create a new threat model based on &quot;{selectedTemplate?.name}
              &quot;
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="model-name">Model Name</Label>
              <Input
                id="model-name"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder="Enter a name for your new model"
              />
            </div>

            {selectedTemplate && (
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <p className="font-medium">Template Details</p>
                {selectedTemplate.description && (
                  <p className="text-muted-foreground">
                    {selectedTemplate.description}
                  </p>
                )}
                {selectedTemplate.category && (
                  <p>
                    <span className="text-muted-foreground">Category:</span>{" "}
                    {selectedTemplate.category}
                  </p>
                )}
                {selectedTemplate.createdBy && (
                  <p className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="text-muted-foreground">By:</span>{" "}
                    {selectedTemplate.createdBy.name ||
                      selectedTemplate.createdBy.email}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFromTemplate}
              disabled={createFromTemplate.isPending || !newModelName.trim()}
            >
              {createFromTemplate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Model"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
