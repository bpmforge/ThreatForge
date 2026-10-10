import { redirect } from "next/navigation";

/**
 * Libraries index page - redirects to Threats library
 */
export default function LibrariesPage() {
  redirect("/libraries/threats");
}
