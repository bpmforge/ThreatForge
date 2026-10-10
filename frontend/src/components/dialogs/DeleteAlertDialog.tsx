"use client";

/**
 * Delete confirmations: DeleteAlertDialog takes free-form description text;
 * DeleteConfirmDialog renders the common `delete "name"?` sentence.
 */
import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
}

export function DeleteAlertDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  children,
}: DeleteAlertDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{children}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** Name of the item being deleted, shown in quotes. */
  name?: string;
  /** Consequence text shown after the question. */
  warning?: string;
}

/** Delete confirmation that names the item: `delete "name"? <warning>`. */
export function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  name,
  warning = "This action cannot be undone.",
}: DeleteConfirmDialogProps) {
  return (
    <DeleteAlertDialog
      open={open}
      onOpenChange={onClose}
      onConfirm={onConfirm}
      title={title}
    >
      Are you sure you want to delete &quot;{name}&quot;? {warning}
    </DeleteAlertDialog>
  );
}
