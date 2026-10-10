/**
 * Setup Wizard Layout
 * Minimal layout for the first-time setup experience.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup - ThreatForge",
  description: "Configure your ThreatForge instance",
};

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}
