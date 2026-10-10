"use client";

/**
 * Avatar Upload Component
 *
 * Allows users to upload and manage their profile avatar.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2, Upload, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import {
  IMAGE_ACCEPT,
  ImageUploadPreviewDialog,
  SIZE_CLASSES,
  getInitials,
  useImagePicker,
} from "@/components/dialogs/ImageUpload";

interface AvatarUploadProps {
  userName: string;
  size?: "sm" | "md" | "lg" | "xl";
}

function fetchAvatar(): Promise<{ avatarUrl: string }> {
  return apiGet<{ avatarUrl: string }>("/api/users/me/avatar", {
    sameOrigin: true,
  });
}

function uploadAvatar(image: string): Promise<{ avatarUrl: string }> {
  return apiPost<{ avatarUrl: string }>(
    "/api/users/me/avatar",
    { image },
    { sameOrigin: true },
  );
}

function deleteAvatar(): Promise<{ avatarUrl: string }> {
  return apiDelete<{ avatarUrl: string }>("/api/users/me/avatar", {
    sameOrigin: true,
  });
}

export function AvatarUpload({ userName, size = "lg" }: AvatarUploadProps) {
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

  const { data: avatarData } = useQuery({
    queryKey: ["user-avatar"],
    queryFn: fetchAvatar,
  });

  const uploadMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-avatar"] });
      toast.success("Avatar updated");
      closePreview();
    },
    onError: (error: Error) => {
      toast.error("Failed to upload avatar", { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-avatar"] });
      toast.success("Avatar removed");
    },
    onError: (error: Error) => {
      toast.error("Failed to remove avatar", { description: error.message });
    },
  });

  const handleUpload = () => {
    if (previewUrl) {
      uploadMutation.mutate(previewUrl);
    }
  };

  const sizeClass = SIZE_CLASSES[size];

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full">
              <Avatar className={`${sizeClass} cursor-pointer`}>
                <AvatarImage src={avatarData?.avatarUrl} alt={userName} />
                <AvatarFallback className="text-lg">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={triggerFileInput}>
              <Upload className="size-4 mr-2" />
              Upload photo
            </DropdownMenuItem>
            {avatarData?.avatarUrl &&
              !avatarData.avatarUrl.startsWith("data:image/svg") && (
                <DropdownMenuItem
                  onClick={() => deleteMutation.mutate()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4 mr-2" />
                  Remove photo
                </DropdownMenuItem>
              )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div>
          <p className="font-medium">{userName}</p>
          <p className="text-sm text-muted-foreground">
            Click on the avatar to change your photo
          </p>
        </div>
      </div>

      <ImageUploadPreviewDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        title="Update Profile Photo"
        description="Preview your new avatar before saving."
        previewUrl={previewUrl}
        fallbackIcon={<User className="h-16 w-16" />}
        saveLabel="Save Photo"
        isSaving={uploadMutation.isPending}
        onCancel={closePreview}
        onSave={handleUpload}
      />
    </>
  );
}
