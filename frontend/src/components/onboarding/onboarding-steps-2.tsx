"use client";

import { Brain, Users, FileText, Zap, CheckCircle2 } from "lucide-react";
import type { OnboardingStep } from "./onboarding-steps";

export const ONBOARDING_STEPS_2: OnboardingStep[] = [
  {
    id: "ai",
    title: "AI-Powered Analysis",
    description: "Let AI help identify threats in your architecture",
    icon: Brain,
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
          <div className="p-3 bg-primary rounded-xl">
            <Brain className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <h4 className="font-medium">Intelligent Threat Detection</h4>
            <p className="text-sm text-muted-foreground">
              AI analyzes your architecture and suggests relevant threats
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium">AI Features:</h4>
          <ul className="space-y-2">
            {[
              "Automatic threat suggestions based on component types",
              "Context-aware analysis of data flows",
              "Interactive chat for security questions",
              "Mitigation recommendations",
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure your AI provider in Settings → AI Providers
        </p>
      </div>
    ),
  },
  {
    id: "collaboration",
    title: "Real-Time Collaboration",
    description: "Work together with your team in real-time",
    icon: Users,
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <div className="flex -space-x-2">
            {[
              { letter: "A", cls: "bg-primary text-primary-foreground" },
              { letter: "B", cls: "bg-green-500 text-white" },
              { letter: "C", cls: "bg-blue-500 text-white" },
            ].map(({ letter, cls }) => (
              <div
                key={letter}
                className={`h-10 w-10 rounded-full ${cls} flex items-center justify-center font-medium`}
              >
                {letter}
              </div>
            ))}
          </div>
          <div>
            <h4 className="font-medium">Multiple editors, one canvas</h4>
            <p className="text-sm text-muted-foreground">
              See changes instantly as teammates edit
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            {
              icon: Zap,
              title: "Instant sync",
              desc: "Changes appear in real-time for all collaborators",
            },
            {
              icon: Users,
              title: "Presence awareness",
              desc: "See who's viewing and editing the model",
            },
            {
              icon: FileText,
              title: "Version history",
              desc: "Track changes and restore previous versions",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <Icon className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">{title}</h4>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "export",
    title: "Export and Share",
    description: "Generate reports and share with stakeholders",
    icon: FileText,
    content: (
      <div className="space-y-4">
        <p>
          Export your threat models in multiple formats for documentation,
          reviews, and compliance.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              title: "PDF Reports",
              desc: "Professional documents with diagrams and threat tables",
            },
            {
              title: "JSON/YAML",
              desc: "Machine-readable formats for integration",
            },
            {
              title: "PNG/SVG Images",
              desc: "High-quality diagrams for presentations",
            },
            {
              title: "Guest Sharing",
              desc: "Secure links for external stakeholders",
            },
          ].map(({ title, desc }) => (
            <div key={title} className="p-3 border rounded-lg">
              <h4 className="font-medium">{title}</h4>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span>CI/CD integration available for automated threat scanning</span>
        </div>
      </div>
    ),
  },
];
