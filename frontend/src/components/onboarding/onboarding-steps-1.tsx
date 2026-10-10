"use client";

import { Layers, Shield, Brain, Users } from "lucide-react";
import type { OnboardingStep } from "./onboarding-steps";

export const ONBOARDING_STEPS_1: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to ThreatForge",
    description: "The visual threat modeling tool for security-conscious teams",
    icon: Shield,
    content: (
      <div className="space-y-4">
        <p>
          ThreatForge helps you identify and document security threats in your
          software architecture using the STRIDE methodology.
        </p>
        <div className="grid grid-cols-2 gap-4 pt-2">
          {[
            {
              icon: Layers,
              title: "Visual Modeling",
              desc: "Drag-and-drop architecture diagrams",
            },
            {
              icon: Shield,
              title: "STRIDE Analysis",
              desc: "Comprehensive threat categories",
            },
            {
              icon: Brain,
              title: "AI Assistance",
              desc: "Intelligent threat suggestions",
            },
            {
              icon: Users,
              title: "Real-time Collaboration",
              desc: "Work together seamlessly",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon className="h-5 w-5 text-primary" />
              </div>
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
    id: "canvas",
    title: "Building Your Diagram",
    description: "Create architecture diagrams with our visual canvas",
    icon: Layers,
    content: (
      <div className="space-y-4">
        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
          <div className="text-center">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Canvas Preview</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            {
              n: 1,
              title: "Drag components from the palette",
              desc: "Choose from DFD elements, applications, databases, and more",
            },
            {
              n: 2,
              title: "Connect with data flows",
              desc: "Define how data moves between components",
            },
            {
              n: 3,
              title: "Add trust boundaries",
              desc: "Group components by security zones",
            },
          ].map(({ n, title, desc }) => (
            <div key={n} className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                {n}
              </div>
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
    id: "threats",
    title: "Identifying Threats",
    description: "Use STRIDE methodology to analyze security risks",
    icon: Shield,
    content: (
      <div className="space-y-4">
        <p>
          STRIDE is a threat classification framework developed by Microsoft.
          Each letter represents a category of threats:
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            {
              letter: "S",
              word: "poofing",
              desc: "Impersonating users or systems",
              bg: "red",
            },
            {
              letter: "T",
              word: "ampering",
              desc: "Unauthorized data modification",
              bg: "orange",
            },
            {
              letter: "R",
              word: "epudiation",
              desc: "Denying performed actions",
              bg: "yellow",
            },
            {
              letter: "I",
              word: "nformation Disclosure",
              desc: "Exposing sensitive data",
              bg: "green",
            },
            {
              letter: "D",
              word: "enial of Service",
              desc: "Making systems unavailable",
              bg: "blue",
            },
            {
              letter: "E",
              word: "levation of Privilege",
              desc: "Gaining unauthorized access",
              bg: "purple",
            },
          ].map(({ letter, word, desc, bg }) => (
            <div
              key={letter}
              className={`p-3 bg-${bg}-50 dark:bg-${bg}-950/30 rounded-lg border border-${bg}-200 dark:border-${bg}-900`}
            >
              <span className={`font-bold text-${bg}-700 dark:text-${bg}-400`}>
                {letter}
              </span>
              <span className={`text-${bg}-700 dark:text-${bg}-400`}>
                {word}
              </span>
              <p className={`text-${bg}-600/70 dark:text-${bg}-300/70 mt-1`}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];
