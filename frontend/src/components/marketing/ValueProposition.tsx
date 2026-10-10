"use client";

import {
  Shield,
  Workflow,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

interface FeatureHighlight {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: FeatureHighlight[] = [
  {
    icon: Shield,
    title: "STRIDE Methodology",
    description: "Industry-standard threat categorization",
  },
  {
    icon: Workflow,
    title: "Visual Canvas",
    description: "Drag-and-drop threat model diagrams",
  },
  {
    icon: Sparkles,
    title: "AI Suggestions",
    description: "Intelligent threat recommendations",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Real-time multiplayer editing",
  },
];

interface ValuePropositionProps {
  variant?: "compact" | "full";
}

export function ValueProposition({
  variant = "compact",
}: ValuePropositionProps) {
  return (
    <div className="space-y-6">
      <p className="text-center text-muted-foreground">
        Visual threat modeling for modern security teams
      </p>

      <div
        className={`grid gap-4 ${variant === "full" ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`}
      >
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex flex-col items-center text-center p-3 rounded-lg bg-background/50"
          >
            <feature.icon
              className="h-6 w-6 text-primary mb-2"
              aria-hidden="true"
            />
            <h3 className="text-sm font-medium">{feature.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
