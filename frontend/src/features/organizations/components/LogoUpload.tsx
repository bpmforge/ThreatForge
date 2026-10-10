"use client";

/**
 * Organization Logo Upload Component
 *
 * Allows organization admins to upload and manage the organization logo.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2, Upload, Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import {
  IMAGE_ACCEPT,
  ImageUploadPreviewDialog,
  SIZE_CLASSES,
  getInitials,
  useImagePicker,
} from "@/components/dialogs/ImageUpload";

interface LogoUploadProps {
  orgId: string;
  orgName: string;
  canEdit: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}

async function fetchLogo(orgId: string): Promise<{ logoUrl: string }> {
  return apiGet<{ logoUrl: string }>(`/api/organizations/${orgId}/logo`);
}

async function uploadLogo(
  orgId: string,
  image: string,
): Promise<{ logoUrl: string }> {
  return apiPost<{ logoUrl: string }>(`/api/organizations/${orgId}/logo`, {
    image,
  });
}

async function deleteLogo(orgId: string): Promise<{ logoUrl: string }> {
  return apiDelete<{ logoUrl: string }>(`/api/organizations/${orgId}/logo`);
}

export function LogoUpload({
  orgId,
  orgName,
  canEdit,
  size = "lg",
}: LogoUploadProps) {
  const queryClient = useQueryClient();
  const {
    fileInputRef,
    previewUrl,
    showPreviewDialog,
    setShowPreviewDialog,
    handleFileSelect,
    triggerFileInput,
    closePreview,
  } = useImagePicker();

  const { data: logoData } = useQuery({
    queryKey: ["org-logo", orgId],
    queryFn: () => fetchLogo(orgId),
    enabled: !!orgId,
  });

  const uploadMutation = useMutation({
    mutationFn: (image: string) => uploadLogo(orgId, image),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-logo", orgId] });
      toast.success("Logo updated");
      closePreview();
    },
    onError: (error: Error) => {
      toast.error("Failed to upload logo", { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLogo(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-logo", orgId] });
      toast.success("Logo removed");
    },
    onError: (error: Error) => {
      toast.error("Failed to remove logo", { description: error.message });
    },
  });

  const handleUpload = () => {
    if (previewUrl) {
      uploadMutation.mutate(previewUrl);
    }
  };

  const sizeClass = SIZE_CLASSES[size];
  const hasCustomLogo =
    logoData?.logoUrl && !logoData.logoUrl.startsWith("data:image/svg");

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex items-center gap-4">
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg">
                <Avatar className={`${sizeClass} cursor-pointer rounded-lg`}>
                  <AvatarImage
                    src={logoData?.logoUrl}
                    alt={orgName}
                    className="rounded-lg"
                  />
                  <AvatarFallback className="text-lg rounded-lg">
                    {getInitials(orgName)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={triggerFileInput}>
                <Upload className="size-4 mr-2" />
                Upload logo
              </DropdownMenuItem>
              {hasCustomLogo && (
                <DropdownMenuItem
                  onClick={() => deleteMutation.mutate()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4 mr-2" />
                  Remove logo
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Avatar className={`${sizeClass} rounded-lg`}>
            <AvatarImage
              src={logoData?.logoUrl}
              alt={orgName}
              className="rounded-lg"
            />
            <AvatarFallback className="text-lg rounded-lg">
              {getInitials(orgName)}
            </AvatarFallback>
          </Avatar>
        )}

        <div>
          <p className="font-medium">{orgName}</p>
          {canEdit && (
            <p className="text-sm text-muted-foreground">
              Click on the logo to change it
            </p>
          )}
        </div>
      </div>

      <ImageUploadPreviewDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        title="Update Organization Logo"
        description="Preview your new logo before saving."
        previewUrl={previewUrl}
        avatarClassName="rounded-lg"
        fallbackIcon={<Building2 className="h-16 w-16" />}
        saveLabel="Save Logo"
        isSaving={uploadMutation.isPending}
        onCancel={closePreview}
        onSave={handleUpload}
      />
    </>
  );
}
