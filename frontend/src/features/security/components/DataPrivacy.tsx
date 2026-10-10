"use client";

/**
 * Data Privacy Component
 *
 * GDPR compliance: Export personal data and request account deletion.
 */
import { useState } from "react";
import {
  Download,
  Trash2,
  Loader2,
  AlertTriangle,
  Shield,
  FileJson,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { ApiError, apiDelete, apiGetBlob } from "@/lib/api-client";

export function DataPrivacy() {
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function exportData() {
    setIsExporting(true);
    try {
      const blob = await apiGetBlob("/api/users/me/data-export");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `personal-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Data export downloaded");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error("Export failed", { description: error.message });
      } else {
        toast.error("Export failed");
      }
    } finally {
      setIsExporting(false);
    }
  }

  async function requestDeletion() {
    if (deleteConfirmation !== "DELETE MY ACCOUNT") {
      toast.error('Please type "DELETE MY ACCOUNT" to confirm');
      return;
    }

    setIsDeleting(true);
    try {
      const data = await apiDelete<{ message?: string }>("/api/users/me/data", {
        body: {
          confirmation: deleteConfirmation,
          password: deletePassword || undefined,
        },
      });
      toast.success("Account scheduled for deletion", {
        description: data?.message,
      });
      setShowDeleteDialog(false);
      setDeleteConfirmation("");
      setDeletePassword("");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error("Deletion request failed", { description: error.message });
      } else {
        toast.error("Failed to request deletion");
      }
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data Privacy
          </CardTitle>
          <CardDescription>
            Manage your personal data and privacy settings (GDPR)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Data Export */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <FileJson className="h-5 w-5 mt-0.5 text-blue-500" />
              <div className="flex-1">
                <h4 className="font-medium">Export Your Data</h4>
                <p className="text-sm text-muted-foreground">
                  Download a copy of all your personal data, including your
                  profile, organizations, sessions, API tokens, and activity
                  history.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={exportData}
              disabled={isExporting}
              className="ml-8"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download My Data
            </Button>
          </div>

          {/* Account Deletion */}
          <div className="p-4 border border-destructive/50 rounded-lg space-y-3 bg-destructive/5">
            <div className="flex items-start gap-3">
              <Trash2 className="h-5 w-5 mt-0.5 text-destructive" />
              <div className="flex-1">
                <h4 className="font-medium text-destructive">Delete Account</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data. This
                  action has a 30-day grace period during which you can cancel.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              className="ml-8"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Request Account Deletion
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Your Account
            </DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all your data.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Your profile and personal data will be deleted</li>
                <li>You will be removed from all organizations</li>
                <li>Your API tokens will be revoked</li>
                <li>This cannot be undone after 30 days</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">
                Type <strong>DELETE MY ACCOUNT</strong> to confirm
              </Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-password">Password (if set)</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmation("");
                setDeletePassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={requestDeletion}
              disabled={
                deleteConfirmation !== "DELETE MY ACCOUNT" || isDeleting
              }
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete My Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
