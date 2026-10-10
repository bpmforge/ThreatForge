"use client";

/**
 * Edit Framework Dialog
 *
 * Dialog for editing an existing custom compliance framework.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";
import type { CustomFrameworkData } from "./types";

interface EditFrameworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  framework: CustomFrameworkData | null;
}

export function EditFrameworkDialog({
  open,
  onOpenChange,
  framework,
}: EditFrameworkDialogProps) {
  if (!framework) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Framework: {framework.name}</DialogTitle>
          <DialogDescription>
            Modify framework details, categories, and controls
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Framework Name</Label>
              <Input defaultValue={framework.name} />
            </div>
            <div className="space-y-2">
              <Label>Short Name</Label>
              <Input defaultValue={framework.shortName} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea defaultValue={framework.description} rows={2} />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Categories & Controls</h3>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Category
              </Button>
            </div>

            {framework.categories.map((category) => (
              <Card key={category.id}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{category.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost">
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {category.controls.map((control) => (
                      <div
                        key={control.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{control.controlId}</Badge>
                            <span className="font-medium text-sm">
                              {control.name}
                            </span>
                            <Badge
                              variant={
                                control.severity === "CRITICAL"
                                  ? "destructive"
                                  : control.severity === "HIGH"
                                    ? "default"
                                    : "secondary"
                              }
                            >
                              {control.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {control.description}
                          </p>
                          {control.mappedControls &&
                            Object.keys(control.mappedControls).length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <Link2 className="h-3 w-3 text-muted-foreground" />
                                {Object.entries(control.mappedControls).map(
                                  ([fw, ctrls]) => (
                                    <Badge
                                      key={fw}
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {fw}: {(ctrls as string[]).join(", ")}
                                    </Badge>
                                  ),
                                )}
                              </div>
                            )}
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              toast.success("Framework updated");
            }}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
