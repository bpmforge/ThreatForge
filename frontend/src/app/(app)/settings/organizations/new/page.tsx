"use client";

/**
 * Create Organization Page
 *
 * Form to create a new organization.
 */
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppHeader } from "@/components/layout";
import { useCreateOrganization } from "@/features/organizations";
import { useOrgStore } from "@/stores/org-store";
import { toast } from "sonner";

export default function NewOrganizationPage() {
  const router = useRouter();
  const { setCurrentOrg } = useOrgStore();
  const createOrg = useCreateOrganization();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"TEAM" | "ENTERPRISE">("TEAM");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Organization name is required");
      return;
    }

    try {
      const newOrg = await createOrg.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
      });

      toast.success("Organization created", {
        description: `${newOrg.name} has been created successfully.`,
      });

      // Switch to the new organization
      setCurrentOrg(newOrg.id);

      // Navigate to organization settings
      router.push("/organization");
    } catch (error) {
      toast.error("Failed to create organization", {
        description: getErrorMessage(error, "Unknown error"),
      });
    }
  };

  return (
    <>
      <AppHeader />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Create Organization</CardTitle>
                  <CardDescription>
                    Create a new organization to collaborate with your team on
                    threat models.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Organization Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g., Acme Security Team"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={createOrg.isPending}
                    autoFocus
                  />
                  <p className="text-sm text-muted-foreground">
                    This will be visible to all organization members.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the organization..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={createOrg.isPending}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Organization Type</Label>
                  <Select
                    value={type}
                    onValueChange={(v) => setType(v as "TEAM" | "ENTERPRISE")}
                    disabled={createOrg.isPending}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEAM">
                        <div className="flex flex-col items-start">
                          <span>Team</span>
                          <span className="text-xs text-muted-foreground">
                            For small to medium teams
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="ENTERPRISE">
                        <div className="flex flex-col items-start">
                          <span>Enterprise</span>
                          <span className="text-xs text-muted-foreground">
                            For large organizations with advanced needs
                          </span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>

              <CardFooter className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={createOrg.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createOrg.isPending || !name.trim()}
                >
                  {createOrg.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Organization"
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
    </>
  );
}
