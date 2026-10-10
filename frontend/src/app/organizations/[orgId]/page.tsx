/**
 * Organization settings page
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OrganizationPanel } from "@/features/organizations";

interface Props {
  params: Promise<{ orgId: string }>;
}

export default async function OrganizationPage({ params }: Props) {
  const session = await auth();
  const { orgId } = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  return <OrganizationPanel orgId={orgId} currentUserId={session.user.id} />;
}
