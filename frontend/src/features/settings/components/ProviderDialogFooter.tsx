/**
 * ProviderDialogFooter - Cancel/submit footer shared by the provider dialogs.
 */
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface ProviderDialogFooterProps {
  onCancel: () => void;
  isPending: boolean;
  disabled: boolean;
  submitLabel: string;
}

export function ProviderDialogFooter({
  onCancel,
  isPending,
  disabled,
  submitLabel,
}: ProviderDialogFooterProps) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={isPending || disabled}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}
