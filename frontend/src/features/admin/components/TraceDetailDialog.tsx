"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Span {
  spanId: string;
  name: string;
  status: string;
  duration: number;
  attributes?: Record<string, unknown>;
}

interface TraceDetail {
  traceId: string;
  spans: Span[];
}

interface TraceDetailDialogProps {
  open: boolean;
  onClose: () => void;
  traceDetail: TraceDetail | undefined;
}

export function TraceDetailDialog({
  open,
  onClose,
  traceDetail,
}: TraceDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Trace Details</DialogTitle>
        </DialogHeader>
        {traceDetail ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-mono">
              {traceDetail.traceId}
            </p>
            <div className="space-y-2">
              {traceDetail.spans.map((span) => (
                <div
                  key={span.spanId}
                  className="p-3 rounded-lg border bg-muted/30 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{span.name}</span>
                    <Badge
                      variant={span.status === "ok" ? "default" : "destructive"}
                    >
                      {span.status === "ok" ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {span.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Duration: {span.duration.toFixed(2)}ms
                  </div>
                  {span.attributes &&
                    Object.keys(span.attributes).length > 0 && (
                      <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                        {JSON.stringify(span.attributes, null, 2)}
                      </pre>
                    )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-pulse space-y-2">
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
