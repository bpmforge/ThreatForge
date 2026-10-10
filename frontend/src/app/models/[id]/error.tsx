"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CanvasError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[CanvasError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 p-8 bg-background">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div className="text-center max-w-md">
        <h2 className="text-lg font-semibold mb-1">Canvas failed to load</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
            {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={reset}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Reload canvas
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (window.location.href = "/dashboard")}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
