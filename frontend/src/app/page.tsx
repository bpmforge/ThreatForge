/**
 * ThreatForge - Root Page
 *
 * Shows landing page for unauthenticated users, redirects to dashboard for authenticated users.
 * Can be configured to always redirect via SKIP_LANDING_PAGE=true env var.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Workflow,
  Sparkles,
  Users,
  FileText,
  Lock,
} from "lucide-react";

const FEATURES = [
  {
    icon: Shield,
    title: "STRIDE Methodology",
    description:
      "Industry-standard threat categorization with built-in threat libraries.",
  },
  {
    icon: Workflow,
    title: "Visual Canvas",
    description: "Drag-and-drop threat model diagrams with trust boundaries.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Analysis",
    description: "Intelligent threat suggestions and automatic detection.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Real-time multiplayer editing with role-based access.",
  },
  {
    icon: FileText,
    title: "Export & Reports",
    description: "Generate PDF reports, JSON, YAML, and image exports.",
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description: "SSO, audit logging, and compliance-ready deployment.",
  },
];

function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-700/25 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-8 flex items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                ThreatForge
              </h1>
            </div>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Visual threat modeling for modern security teams. Create, analyze,
              and document security threats with AI-powered insights and
              real-time collaboration.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Button asChild size="lg" className="h-12 px-8 text-base">
                <Link href="/register">Get Started Free</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base"
              >
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Everything you need for threat modeling
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Built for security architects, developers, and DevSecOps teams.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <feature.icon className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-700 bg-slate-800/50 p-8 text-center backdrop-blur sm:p-12">
          <h2 className="text-2xl font-bold text-white">
            Ready to secure your applications?
          </h2>
          <p className="mt-4 text-slate-400">
            Start creating threat models in minutes. No credit card required.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="h-12 px-8 text-base">
              <Link href="/register">Create Free Account</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-center text-sm text-slate-500">
            ThreatForge - Visual Security Analysis
          </p>
        </div>
      </footer>
    </main>
  );
}

export default async function Home() {
  // Check if user is authenticated
  const session = await auth();

  // If authenticated, redirect to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  // Skip landing page if configured (for self-hosted deployments that prefer direct login)
  if (process.env.SKIP_LANDING_PAGE === "true") {
    redirect("/login");
  }

  // Show landing page for unauthenticated users
  return <LandingPage />;
}
