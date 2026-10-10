"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { NewDiagramType } from "../hooks/useDiagramTabs";

interface DiagramNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "rename";
  diagramType: NewDiagramType;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

const TYPE_LABEL: Record<NewDiagramType, string> = {
  dfd: "Data Flow Diagram",
  sequence: "Sequence Diagram",
};

const TYPE_PLACEHOLDER: Record<NewDiagramType, string> = {
  dfd: "e.g., User Registration Flow",
  sequence: "e.g., Login Flow",
};

export function DiagramNameDialog({
  open,
  onOpenChange,
  mode,
  diagramType,
  value,
  onChange,
  onSubmit,
  isPending,
}: DiagramNameDialogProps) {
  const label = TYPE_LABEL[diagramType];
  const isCreate = mode === "create";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? "New" : "Rename"} {label}
          </DialogTitle>
          {isCreate && (
            <DialogDescription>
              {diagramType === "dfd"
                ? "Create a new DFD to show how data flows through the system."
                : "Create a new sequence diagram to show dynamic interactions."}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder={isCreate ? TYPE_PLACEHOLDER[diagramType] : undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!value.trim() || isPending}>
            {isPending
              ? isCreate
                ? "Creating..."
                : "Saving..."
              : isCreate
                ? "Create"
                : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
