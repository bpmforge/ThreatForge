"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExecutionLog } from "../hooks/useExecutionLogs";
import { STATUS_ICONS, STATUS_LABELS } from "./ExecutionLogRow";

function FieldLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-xs text-muted-foreground font-medium ${className ?? ""}`}
    >
      {children}
    </p>
  );
}

interface ExecutionLogDetailDialogProps {
  orgId: string;
  logId: string | null;
  onClose: () => void;
}

export function ExecutionLogDetailDialog({
  orgId,
  logId,
  onClose,
}: ExecutionLogDetailDialogProps) {
  const { data: log, isLoading } = useExecutionLog(orgId, logId ?? undefined);

  return (
    <Dialog open={!!logId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Execution Details
            {log && STATUS_ICONS[log.status]}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : log ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="input">Input</TabsTrigger>
              <TabsTrigger value="output">Output</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Prompt</FieldLabel>
                  <p className="font-medium">{log.promptTemplateName}</p>
                </div>
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <p className="flex items-center gap-1.5">
                    {STATUS_ICONS[log.status]}
                    {STATUS_LABELS[log.status]}
                  </p>
                </div>
                <div>
                  <FieldLabel>Duration</FieldLabel>
                  <p>{log.durationMs ? `${log.durationMs}ms` : "-"}</p>
                </div>
                <div>
                  <FieldLabel>Tokens Used</FieldLabel>
                  <p>{log.tokensUsed?.toLocaleString() ?? "-"}</p>
                </div>
                <div>
                  <FieldLabel>Model</FieldLabel>
                  <p>{log.model ?? "-"}</p>
                </div>
                <div>
                  <FieldLabel>Provider</FieldLabel>
                  <p>{log.provider ?? "-"}</p>
                </div>
                <div>
                  <FieldLabel>Started</FieldLabel>
                  <p>{new Date(log.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <FieldLabel>Completed</FieldLabel>
                  <p>
                    {log.completedAt
                      ? new Date(log.completedAt).toLocaleString()
                      : "-"}
                  </p>
                </div>
              </div>
              {log.errorMessage && (
                <div className="p-4 bg-destructive/10 rounded-md border border-destructive/20">
                  <FieldLabel className="text-destructive">Error</FieldLabel>
                  <p className="text-sm mt-1">{log.errorMessage}</p>
                  {log.errorCode && (
                    <Badge variant="destructive" className="mt-2">
                      {log.errorCode}
                    </Badge>
                  )}
                </div>
              )}
            </TabsContent>
            <TabsContent value="input">
              <ScrollArea className="h-[400px] rounded-md border p-4">
                {log.inputDocument && (
                  <div className="mb-4">
                    <FieldLabel>Document</FieldLabel>
                    <pre className="mt-1 text-xs bg-muted p-3 rounded-md whitespace-pre-wrap">
                      {log.inputDocument.slice(0, 5000)}
                      {log.inputDocument.length > 5000 && "...(truncated)"}
                    </pre>
                  </div>
                )}
                {log.inputVariables && (
                  <div>
                    <FieldLabel>Variables</FieldLabel>
                    <pre className="mt-1 text-xs bg-muted p-3 rounded-md whitespace-pre-wrap">
                      {JSON.stringify(JSON.parse(log.inputVariables), null, 2)}
                    </pre>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            <TabsContent value="output">
              <ScrollArea className="h-[400px] rounded-md border p-4">
                {log.outputResult && (
                  <div className="mb-4">
                    <FieldLabel>Raw Output</FieldLabel>
                    <pre className="mt-1 text-xs bg-muted p-3 rounded-md whitespace-pre-wrap">
                      {log.outputResult.slice(0, 10000)}
                      {log.outputResult.length > 10000 && "...(truncated)"}
                    </pre>
                  </div>
                )}
                {log.outputParsed && (
                  <div>
                    <FieldLabel>Parsed Output</FieldLabel>
                    <pre className="mt-1 text-xs bg-muted p-3 rounded-md whitespace-pre-wrap">
                      {JSON.stringify(JSON.parse(log.outputParsed), null, 2)}
                    </pre>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <p className="text-muted-foreground">Log not found</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
