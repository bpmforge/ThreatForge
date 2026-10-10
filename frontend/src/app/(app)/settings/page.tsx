/**
 * Settings Page - Redirect to Profile
 *
 * This page now redirects to /profile for backward compatibility.
 * The settings have been split into:
 * - /profile - User profile settings (accessible to all users)
 * - /organization - Organization settings (Owner/Admin only)
 * - /admin - System admin settings (System Admin only)
 */
import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/profile");
}
