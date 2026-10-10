"use client";

import { useState } from "react";
import { useMultiSelect } from "../hooks/useMultiSelect";
import { useBulkOperations } from "../hooks/useBulkOperations";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalSpaceBetween,
  AlignVerticalSpaceBetween,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

function TipBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function FloatingActionBar() {
  const { selectCount, clearSelection } = useMultiSelect();
  const {
    deleteSelected,
    alignNodes,
    distributeNodes,
    canAlign,
    canDistribute,
  } = useBulkOperations();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  if (selectCount < 2) return null;

  const handleDelete = () => {
    deleteSelected();
    toast.success(`Deleted ${selectCount} items`);
    setIsDeleteOpen(false);
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-background border rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground pr-1">
            {selectCount} selected
          </span>

          <Separator orientation="vertical" className="h-5" />

          {/* Left / Center-H / Right */}
          <TipBtn
            label="Align left edges"
            disabled={!canAlign}
            onClick={() => alignNodes("left")}
          >
            <AlignStartVertical className="h-3.5 w-3.5" />
          </TipBtn>
          <TipBtn
            label="Align centers (horizontal)"
            disabled={!canAlign}
            onClick={() => alignNodes("center")}
          >
            <AlignCenterVertical className="h-3.5 w-3.5" />
          </TipBtn>
          <TipBtn
            label="Align right edges"
            disabled={!canAlign}
            onClick={() => alignNodes("right")}
          >
            <AlignEndVertical className="h-3.5 w-3.5" />
          </TipBtn>

          <Separator orientation="vertical" className="h-5" />

          {/* Top / Middle-V / Bottom */}
          <TipBtn
            label="Align top edges"
            disabled={!canAlign}
            onClick={() => alignNodes("top")}
          >
            <AlignStartHorizontal className="h-3.5 w-3.5" />
          </TipBtn>
          <TipBtn
            label="Align middles (vertical)"
            disabled={!canAlign}
            onClick={() => alignNodes("middle")}
          >
            <AlignCenterHorizontal className="h-3.5 w-3.5" />
          </TipBtn>
          <TipBtn
            label="Align bottom edges"
            disabled={!canAlign}
            onClick={() => alignNodes("bottom")}
          >
            <AlignEndHorizontal className="h-3.5 w-3.5" />
          </TipBtn>

          <Separator orientation="vertical" className="h-5" />

          {/* Distribute — gap mode */}
          <TipBtn
            label="Distribute horizontally (equal gaps)"
            disabled={!canDistribute}
            onClick={() => distributeNodes("horizontal", "gap")}
          >
            <AlignHorizontalSpaceBetween className="h-3.5 w-3.5" />
          </TipBtn>
          <TipBtn
            label="Distribute vertically (equal gaps)"
            disabled={!canDistribute}
            onClick={() => distributeNodes("vertical", "gap")}
          >
            <AlignVerticalSpaceBetween className="h-3.5 w-3.5" />
          </TipBtn>

          {/* Distribute — center-to-center mode */}
          <TipBtn
            label="Distribute horizontal centers"
            disabled={!canDistribute}
            onClick={() => distributeNodes("horizontal", "centers")}
          >
            <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />
          </TipBtn>
          <TipBtn
            label="Distribute vertical centers"
            disabled={!canDistribute}
            onClick={() => distributeNodes("vertical", "centers")}
          >
            <AlignVerticalDistributeCenter className="h-3.5 w-3.5" />
          </TipBtn>

          <Separator orientation="vertical" className="h-5" />

          <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 px-2 gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectCount} items?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  selected components and their associated threats.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={clearSelection}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
