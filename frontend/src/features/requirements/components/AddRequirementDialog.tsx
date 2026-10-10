"use client";

/**
 * AddRequirementDialog — Manually add a single requirement.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useCreateRequirement } from "../hooks/useRequirements";

interface AddRequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
}

export function AddRequirementDialog({
  open,
  onOpenChange,
  modelId,
}: AddRequirementDialogProps) {
  const [reqId, setReqId] = useState("");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [docId, setDocId] = useState("");

  const create = useCreateRequirement(modelId);

  const reset = () => {
    setReqId("");
    setText("");
    setCategory("");
    setDocId("");
  };

  const handleSubmit = async () => {
    if (!reqId.trim() || !text.trim()) return;
    try {
      await create.mutateAsync({
        reqId: reqId.trim(),
        text: text.trim(),
        category: category.trim() || undefined,
        docId: docId.trim() || undefined,
        source: "MANUAL",
      });
      toast.success(`Requirement ${reqId} added`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to add requirement");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Requirement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="add-req-id" className="text-xs">
                Req ID *
              </Label>
              <Input
                id="add-req-id"
                value={reqId}
                onChange={(e) => setReqId(e.target.value)}
                placeholder="FR-12"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-req-doc" className="text-xs">
                Doc ID
              </Label>
              <Input
                id="add-req-doc"
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                placeholder="SRS"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-req-text" className="text-xs">
              Text *
            </Label>
            <Textarea
              id="add-req-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="System shall…"
              rows={3}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-req-cat" className="text-xs">
              Category
            </Label>
            <Input
              id="add-req-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="security"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reqId.trim() || !text.trim() || create.isPending}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
