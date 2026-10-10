"use client";

/**
 * ExpertAnalysisButton — Toolbar button to trigger the 6-pass expert analysis.
 */
import { useState } from "react";
import { BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";
import { useExpertAnalysis } from "../hooks/useExpertAnalysis";

interface ExpertAnalysisButtonProps {
  modelId: string | null;
  onJobComplete?: (result: unknown) => void;
}

export function ExpertAnalysisButton({ modelId }: ExpertAnalysisButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const { runAnalysis, loading } = useExpertAnalysis(modelId);

  const handleConfirm = async () => {
    setShowConfirm(false);
    await runAnalysis();
  };

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowConfirm(true)}
              disabled={!modelId || loading}
              className="h-8 w-8"
              aria-label="Run Expert Analysis"
            >
              <BrainCircuit className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Expert Analysis (6-Pass AI)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run Expert Analysis?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  This runs a comprehensive 6-pass AI analysis of your threat
                  model:
                </p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>
                    <strong>Understand</strong> — Classify architecture &amp;
                    attack surface
                  </li>
                  <li>
                    <strong>Analyze Flows</strong> — Examine every data flow
                    &amp; trust boundary
                  </li>
                  <li>
                    <strong>Identify Threats</strong> — Full STRIDE analysis per
                    component
                  </li>
                  <li>
                    <strong>Attack Chains</strong> — Trace lateral movement
                    paths
                  </li>
                  <li>
                    <strong>Verify</strong> — Filter false positives, check
                    quality (×2)
                  </li>
                  <li>
                    <strong>Consolidate</strong> — Deduplicate &amp; prioritize
                  </li>
                </ol>
                <p className="text-muted-foreground">
                  This runs in the background and typically takes 2-5 minutes.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              <BrainCircuit className="h-4 w-4 mr-2" />
              Start Analysis
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
