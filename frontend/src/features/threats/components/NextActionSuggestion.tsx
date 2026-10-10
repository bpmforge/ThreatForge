"use client";

/**
 * Next Action Suggestion
 *
 * After key actions (threat generation, model creation, etc.),
 * guide the user to the next logical step.
 */

import {
  Shield,
  FileCheck,
  Users,
  BarChart3,
  Download,
  ChevronRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Action {
  icon: ReactNode;
  title: string;
  description: string;
  action: () => void;
}

interface NextActionSuggestionProps {
  /** What the user just did */
  context:
    | "model_created"
    | "threats_generated"
    | "threats_mitigated"
    | "review_complete"
    | "export_done";
  /** Callbacks for each action */
  onAddThreats?: () => void;
  onRequestReview?: () => void;
  onViewDashboard?: () => void;
  onExportReport?: () => void;
  onAddMitigations?: () => void;
  onRunCompliance?: () => void;
}

const ACTION_MAP: Record<
  string,
  (props: NextActionSuggestionProps) => Action[]
> = {
  model_created: (props) => [
    {
      icon: <Shield className="h-4 w-4" />,
      title: "Generate Threats",
      description: "Use AI to identify STRIDE threats for each component",
      action: props.onAddThreats || (() => {}),
    },
    {
      icon: <Users className="h-4 w-4" />,
      title: "Invite Collaborators",
      description: "Share with your team for real-time collaboration",
      action: props.onRequestReview || (() => {}),
    },
  ],
  threats_generated: (props) => [
    {
      icon: <FileCheck className="h-4 w-4" />,
      title: "Add Mitigations",
      description:
        "Define how each threat will be addressed (prevent, detect, respond)",
      action: props.onAddMitigations || (() => {}),
    },
    {
      icon: <BarChart3 className="h-4 w-4" />,
      title: "Run Compliance Check",
      description: "Map threats to SOC2, HIPAA, or other frameworks",
      action: props.onRunCompliance || (() => {}),
    },
  ],
  threats_mitigated: (props) => [
    {
      icon: <Users className="h-4 w-4" />,
      title: "Request Review",
      description: "Get a peer review before finalizing the threat model",
      action: props.onRequestReview || (() => {}),
    },
    {
      icon: <Download className="h-4 w-4" />,
      title: "Export Report",
      description: "Generate PDF or compliance report for stakeholders",
      action: props.onExportReport || (() => {}),
    },
  ],
  review_complete: (props) => [
    {
      icon: <Download className="h-4 w-4" />,
      title: "Export Report",
      description: "Generate final report for compliance and stakeholders",
      action: props.onExportReport || (() => {}),
    },
    {
      icon: <BarChart3 className="h-4 w-4" />,
      title: "View Risk Dashboard",
      description: "See this model's risk in context of all projects",
      action: props.onViewDashboard || (() => {}),
    },
  ],
  export_done: (props) => [
    {
      icon: <BarChart3 className="h-4 w-4" />,
      title: "View Dashboard",
      description: "Track risk trends across your organization",
      action: props.onViewDashboard || (() => {}),
    },
  ],
};

export function NextActionSuggestion(props: NextActionSuggestionProps) {
  const actions = ACTION_MAP[props.context]?.(props) || [];

  if (actions.length === 0) return null;

  return (
    <div className="rounded-lg border bg-accent/50 p-4 space-y-3">
      <p className="text-sm font-medium">What to do next:</p>
      <div className="space-y-2">
        {actions.map((action, i) => (
          <Button
            key={i}
            variant="ghost"
            onClick={action.action}
            className="w-full flex items-center gap-3 h-auto p-2 justify-start text-left"
          >
            <div className="text-muted-foreground">{action.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{action.title}</p>
              <p className="text-xs text-muted-foreground font-normal">
                {action.description}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Button>
        ))}
      </div>
    </div>
  );
}
