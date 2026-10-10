"use client";

/**
 * NodeIconSection — upload a custom PNG/JPEG/SVG/WebP icon for a component node.
 *
 * Resizes to 128×128 via OffscreenCanvas (or a fallback <canvas>) before
 * storing as a base64 data URL in ComponentNodeData.customIcon.
 */
import { useRef, useCallback } from "react";
import { ImagePlus, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Section } from "./Section";
import type { ComponentNodeData } from "@/types/canvas";

const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TARGET_SIZE = 128; // px — max dimension

/** Resize an image file to TARGET_SIZE×TARGET_SIZE, returning a PNG data URL. */
async function resizeImage(file: File): Promise<string> {
  if (file.type === "image/svg+xml") {
    // SVGs scale losslessly — just read as data URL without resizing.
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(TARGET_SIZE / width, TARGET_SIZE / height, 1);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/png");
}

interface NodeIconSectionProps {
  data: ComponentNodeData;
  onSetIcon: (dataUrl: string) => void;
  onClearIcon: () => void;
}

export function NodeIconSection({
  data,
  onSetIcon,
  onClearIcon,
}: NodeIconSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > MAX_BYTES) {
        alert("Image must be under 5 MB.");
        return;
      }
      try {
        const dataUrl = await resizeImage(file);
        onSetIcon(dataUrl);
      } catch {
        alert("Could not process this image. Try a PNG or JPEG.");
      } finally {
        // Reset so the same file can be re-uploaded after clearing
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [onSetIcon],
  );

  return (
    <Section title="Node Icon" icon={ImagePlus} defaultOpen={false}>
      <div className="space-y-3">
        {data.customIcon ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={data.customIcon}
                alt="Custom node icon"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1.5">
                Custom icon active
              </p>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                  onClick={onClearIcon}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Replace the default icon with a custom image
            </Label>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Upload Icon
            </Button>
            <p className="text-[10px] text-muted-foreground">
              PNG, JPEG, WebP, GIF or SVG · max 5 MB
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          aria-label="Upload custom node icon"
          onChange={handleFileChange}
        />
      </div>
    </Section>
  );
}
