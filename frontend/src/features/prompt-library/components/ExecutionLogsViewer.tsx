"use client";

import React, { useState } from "react";
import { Activity, Clock, Coins, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useExecutionLogs, useExecutionStats } from "../hooks/useExecutionLogs";
import { usePrompts } from "../hooks/usePrompts";
import { ExecutionStatCard } from "./ExecutionStatCard";
import { ExecutionLogRow, STATUS_LABELS } from "./ExecutionLogRow";
import { ExecutionLogDetailDialog } from "./ExecutionLogDetailDialog";

interface ExecutionLogsViewerProps {
  orgId: string;
}

export function ExecutionLogsViewer({ orgId }: ExecutionLogsViewerProps) {
  const [selectedPromptId, setSelectedPromptId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: prompts } = usePrompts(orgId);
  const { data: statsData, isLoading: statsLoading } = useExecutionStats(orgId);
  const {
    data: logsData,
    isLoading: logsLoading,
    refetch,
  } = useExecutionLogs(orgId, {
    promptId: selectedPromptId !== "all" ? selectedPromptId : undefined,
    status: selectedStatus !== "all" ? selectedStatus : undefined,
    limit: pageSize,
    offset: page * pageSize,
  });

  const stats = statsData?.stats;
  const usageByPrompt = statsData?.usageByPrompt ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ExecutionStatCard
          title="Total Executions"
          value={stats?.totalExecutions ?? 0}
          icon={<Activity className="h-4 w-4" />}
          loading={statsLoading}
        />
        <ExecutionStatCard
          title="Success Rate"
          value={`${((stats?.successRate ?? 0) * 100).toFixed(1)}%`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          loading={statsLoading}
        />
        <ExecutionStatCard
          title="Avg Duration"
          value={`${Math.round(stats?.avgDurationMs ?? 0)}ms`}
          icon={<Clock className="h-4 w-4" />}
          loading={statsLoading}
        />
        <ExecutionStatCard
          title="Total Tokens"
          value={stats?.totalTokensUsed?.toLocaleString() ?? "0"}
          icon={<Coins className="h-4 w-4" />}
          loading={statsLoading}
        />
      </div>

      {usageByPrompt.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage by Prompt</CardTitle>
            <CardDescription>Most frequently used prompts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {usageByPrompt.slice(0, 5).map((item) => (
                <div key={item.promptId} className="flex items-center gap-2">
                  <span className="flex-1 text-sm truncate">
                    {item.promptName}
                  </span>
                  <Badge variant="secondary">{item.count} runs</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Execution History</CardTitle>
              <CardDescription>
                Recent prompt executions ({logsData?.total ?? 0} total)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={logsLoading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${logsLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Select
              value={selectedPromptId}
              onValueChange={setSelectedPromptId}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Prompts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Prompts</SelectItem>
                {prompts?.map((prompt) => (
                  <SelectItem key={prompt.id} value={prompt.id}>
                    {prompt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Prompt</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px]">Duration</TableHead>
                  <TableHead className="w-[80px]">Tokens</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : !logsData?.logs?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No execution logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logsData.logs.map((log) => (
                    <ExecutionLogRow
                      key={log.id}
                      log={log}
                      onSelect={() => setSelectedLogId(log.id)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {logsData && logsData.total > pageSize && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1}-
                {Math.min((page + 1) * pageSize, logsData.total)} of{" "}
                {logsData.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * pageSize >= logsData.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ExecutionLogDetailDialog
        orgId={orgId}
        logId={selectedLogId}
        onClose={() => setSelectedLogId(null)}
      />
    </div>
  );
}
