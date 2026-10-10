/**
 * Organizations Settings Page - Redirect
 *
 * Redirects to the main organization settings page.
 * This handles cases where users navigate to /settings/organizations directly.
 */
import { redirect } from "next/navigation";

export default function OrganizationsPage() {
  redirect("/organization");
}
