"use client";

/**
 * Welcome Step
 * Introduction to the setup wizard.
 */
import { useSetupStore } from "../store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Users, Brain, Lock, ArrowRight, Zap } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Visual Threat Modeling",
    description:
      "Create and manage threat models with an intuitive drag-and-drop interface",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Work together in real-time with your security team",
  },
  {
    icon: Brain,
    title: "AI-Powered Analysis",
    description: "Get intelligent threat suggestions and STRIDE analysis",
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description: "SSO, audit logging, and compliance framework mapping",
  },
];

export function WelcomeStep() {
  const {
    nextStep,
    setQuickStart,
    setupTokenRequired,
    setupToken,
    setSetupToken,
  } = useSetupStore();
  const blocked = setupTokenRequired && !setupToken.trim();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">
          Welcome to ThreatForge
        </h2>
        <p className="mt-2 text-muted-foreground">
          Let&apos;s configure your instance in just a few steps
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <feature.icon className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
        <h3 className="font-medium text-blue-400">
          What you&apos;ll configure:
        </h3>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>• Super admin account for system management</li>
          <li>• Primary organization for your team</li>
          <li>• AI provider for threat analysis (optional)</li>
          <li>• Authentication and security settings</li>
        </ul>
      </div>

      {setupTokenRequired && (
        <div className="space-y-2">
          <Label htmlFor="setup-token">Setup token</Label>
          <Input
            id="setup-token"
            autoComplete="off"
            value={setupToken}
            onChange={(e) => setSetupToken(e.target.value.trim())}
            placeholder="From the server log, or the SETUP_TOKEN you set"
          />
          <p className="text-xs text-muted-foreground">
            The server prints it at startup. Run{" "}
            <code>
              docker compose logs server | grep &quot;Setup token&quot;
            </code>
            .
          </p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          disabled={blocked}
          onClick={() => {
            setQuickStart(true);
            nextStep();
          }}
          className="gap-2 text-muted-foreground"
        >
          <Zap className="h-4 w-4" />
          Quick Start (3 steps)
        </Button>
        <Button onClick={nextStep} disabled={blocked} className="gap-2">
          Full Setup (7 steps)
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-center text-muted-foreground">
        Quick Start sets up admin + organization only. AI, auth, and security
        use sensible defaults — configure later in Settings.
      </p>
    </div>
  );
}
