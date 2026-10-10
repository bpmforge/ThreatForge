"use client";

/**
 * Shared pieces for the image upload components (profile avatar, organization
 * logo): file picking + validation + preview state, and the preview dialog.
 */
import { useState, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const SIZE_CLASSES = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
  xl: "h-32 w-32",
};

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** File input ref, type/size validation, and data-URL preview state. */
export function useImagePicker() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!IMAGE_ACCEPT.split(",").includes(file.type)) {
        toast.error("Invalid file type", {
          description: "Please upload a JPEG, PNG, GIF, or WebP image.",
        });
        return;
      }

      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        toast.error("File too large", {
          description: "Please upload an image under 2MB.",
        });
        return;
      }

      // Read file as data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreviewUrl(result);
        setShowPreviewDialog(true);
      };
      reader.readAsDataURL(file);

      // Reset input
      event.target.value = "";
    },
    [],
  );

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const closePreview = () => {
    setShowPreviewDialog(false);
    setPreviewUrl(null);
  };

  return {
    fileInputRef,
    previewUrl,
    showPreviewDialog,
    setShowPreviewDialog,
    handleFileSelect,
    triggerFileInput,
    closePreview,
  };
}

interface ImageUploadPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  previewUrl: string | null;
  /** Extra classes for the preview Avatar and its image/fallback (e.g. rounding). */
  avatarClassName?: string;
  fallbackIcon: React.ReactNode;
  saveLabel: string;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export function ImageUploadPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  previewUrl,
  avatarClassName,
  fallbackIcon,
  saveLabel,
  isSaving,
  onCancel,
  onSave,
}: ImageUploadPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-6">
          <Avatar className={`h-32 w-32 ${avatarClassName ?? ""}`.trim()}>
            <AvatarImage
              src={previewUrl || undefined}
              alt="Preview"
              className={avatarClassName}
            />
            <AvatarFallback className={avatarClassName}>
              {fallbackIcon}
            </AvatarFallback>
          </Avatar>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
