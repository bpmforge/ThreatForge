"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { METHODS } from "./methods";
import type { CreationMethod } from "./methods";

interface MethodChooserScreenProps {
  backHref: string;
  backLabel: string;
  onSelect: (method: CreationMethod) => void;
}

export function MethodChooserScreen({
  backHref,
  backLabel,
  onSelect,
}: MethodChooserScreenProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-6" asChild>
          <Link href={backHref}>
            <ArrowLeft className="size-4 mr-2" />
            Back to {backLabel}
          </Link>
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Create New Threat Model</h1>
          <p className="text-muted-foreground mt-1">
            How would you like to start?
          </p>
        </div>

        <div className="grid gap-3">
          {METHODS.map((m) => (
            <div key={m.id}>
              {m.id === "describe" && (
                <p className="text-xs font-medium text-muted-foreground px-1">
                  AI-Powered
                </p>
              )}
              {m.id === "import" && (
                <p className="text-xs font-medium text-muted-foreground px-1 mt-3">
                  Import
                </p>
              )}
              {m.id === "template" && (
                <p className="text-xs font-medium text-muted-foreground px-1 mt-3">
                  Manual
                </p>
              )}
              <button
                onClick={() => onSelect(m.id)}
                className="flex items-center gap-4 rounded-xl border p-4 text-left hover:bg-accent transition-colors group w-full"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-background">
                  <m.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.title}</span>
                    {m.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${m.badgeColor}`}
                      >
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {m.description}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
