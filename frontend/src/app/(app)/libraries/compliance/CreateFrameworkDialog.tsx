"use client";

/**
 * Create Framework Dialog
 *
 * Dialog for creating a new custom compliance framework.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMPLIANCE_FRAMEWORKS } from "@/features/threat-library/constants/compliance";
import type { NewFrameworkForm } from "./types";
import { COLOR_OPTIONS } from "./types";

interface CreateFrameworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: NewFrameworkForm;
  onFormChange: (data: NewFrameworkForm) => void;
  onSubmit: () => void;
}

export function CreateFrameworkDialog({
  open,
  onOpenChange,
  formData,
  onFormChange,
  onSubmit,
}: CreateFrameworkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Custom Framework</DialogTitle>
          <DialogDescription>
            Define a new compliance framework for your organization
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Framework Name</Label>
              <Input
                id="name"
                placeholder="e.g., Internal Security Policy"
                value={formData.name}
                onChange={(e) =>
                  onFormChange({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortName">Short Name</Label>
              <Input
                id="shortName"
                placeholder="e.g., ISP"
                value={formData.shortName}
                onChange={(e) =>
                  onFormChange({
                    ...formData,
                    shortName: e.target.value.toUpperCase(),
                  })
                }
                maxLength={10}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the purpose and scope of this framework..."
              value={formData.description}
              onChange={(e) =>
                onFormChange({ ...formData, description: e.target.value })
              }
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                placeholder="1.0"
                value={formData.version}
                onChange={(e) =>
                  onFormChange({ ...formData, version: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Select
                value={formData.color}
                onValueChange={(v) => onFormChange({ ...formData, color: v })}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${formData.color}`} />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${c.value}`} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <Label>Inherit Controls From</Label>
            <p className="text-sm text-muted-foreground">
              Select built-in frameworks to inherit controls from. You can map
              specific controls after creation.
            </p>
            <ScrollArea className="h-[200px] border rounded-md p-4">
              <div className="space-y-2">
                {COMPLIANCE_FRAMEWORKS.map((fw) => (
                  <div key={fw.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={fw.id}
                      checked={formData.inheritedFrameworks.includes(fw.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onFormChange({
                            ...formData,
                            inheritedFrameworks: [
                              ...formData.inheritedFrameworks,
                              fw.id,
                            ],
                          });
                        } else {
                          onFormChange({
                            ...formData,
                            inheritedFrameworks:
                              formData.inheritedFrameworks.filter(
                                (f) => f !== fw.id,
                              ),
                          });
                        }
                      }}
                    />
                    <label
                      htmlFor={fw.id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <div className={`w-2 h-2 rounded-full ${fw.color}`} />
                      <span className="font-medium">{fw.shortName}</span>
                      <span className="text-muted-foreground">- {fw.name}</span>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>Create Framework</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
