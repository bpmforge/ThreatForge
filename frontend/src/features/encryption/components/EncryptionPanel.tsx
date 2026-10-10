"use client";

import { useState } from "react";
import {
  useEncryptionConfig,
  useEncryptionMutations,
} from "../hooks/useEncryption";
import type { EncryptionKey } from "../types";
import { KeyRegistrationDialog } from "./KeyRegistrationDialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Key, Plus, Shield, ShieldOff, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EncryptionPanelProps {
  orgId: string;
}

export function EncryptionPanel({ orgId }: EncryptionPanelProps) {
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<EncryptionKey | null>(null);

  const { data: config, isLoading } = useEncryptionConfig(orgId);
  const { revokeKey, isRevoking, disableBYOK, isDisabling } =
    useEncryptionMutations(orgId);

  const handleRevoke = (key: EncryptionKey) => {
    setKeyToRevoke(key);
  };

  const confirmRevoke = () => {
    if (keyToRevoke) {
      revokeKey(keyToRevoke.version, {
        onSuccess: () => {
          toast.success(`Key v${keyToRevoke.version} revoked`);
          setKeyToRevoke(null);
        },
        onError: (err) => toast.error(err.message),
      });
    }
  };

  const handleDisable = () => {
    disableBYOK(undefined, {
      onSuccess: () => {
        toast.success("BYOK disabled");
        setConfirmDisable(false);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5" />
              <div>
                <CardTitle>Encryption Keys</CardTitle>
                <CardDescription>
                  Manage your organization&apos;s encryption keys (BYOK)
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {config?.enabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDisable(true)}
                >
                  <ShieldOff className="h-4 w-4 mr-1" />
                  Disable BYOK
                </Button>
              )}
              <Button size="sm" onClick={() => setRegisterDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Key
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-muted/50">
            <Shield
              className={cn(
                "h-5 w-5",
                config?.enabled ? "text-green-600" : "text-muted-foreground",
              )}
            />
            <div className="flex-1">
              <p className="font-medium">
                {config?.enabled ? "BYOK Enabled" : "System-Managed Encryption"}
              </p>
              <p className="text-sm text-muted-foreground">
                {config?.enabled
                  ? `Active key version: v${config.activeKeyVersion}`
                  : "Using platform-managed encryption keys"}
              </p>
            </div>
            <Badge variant={config?.enabled ? "default" : "secondary"}>
              {config?.enabled ? "Custom Keys" : "Default"}
            </Badge>
          </div>

          {config?.keys && config.keys.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Key Versions
              </h4>
              {config.keys.map((key) => (
                <div
                  key={key.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    key.isActive &&
                      "border-green-500 bg-green-50 dark:bg-green-950/20",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Key
                      className={cn(
                        "h-4 w-4",
                        key.isActive
                          ? "text-green-600"
                          : "text-muted-foreground",
                      )}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          Version {key.version}
                        </span>
                        {key.isActive && (
                          <Badge className="bg-green-600">Active</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {key.algorithm} • Created{" "}
                        {new Date(key.createdAt).toLocaleDateString()}
                        {key.description && ` • ${key.description}`}
                      </p>
                    </div>
                  </div>
                  {!key.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(key)}
                      disabled={isRevoking}
                      aria-label={`Revoke key version ${key.version}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No custom keys configured</p>
              <p className="text-sm">Add a key to enable BYOK encryption</p>
            </div>
          )}
        </CardContent>
      </Card>

      <KeyRegistrationDialog
        orgId={orgId}
        open={registerDialogOpen}
        onOpenChange={setRegisterDialogOpen}
      />

      {/* Revoke Confirmation */}
      <AlertDialog
        open={!!keyToRevoke}
        onOpenChange={() => setKeyToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Revoke Key Version {keyToRevoke?.version}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently revoke this key version. Data encrypted with
              this key will need to be re-encrypted with an active key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevoke}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRevoking ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disable BYOK Confirmation */}
      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable BYOK?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revert to system-managed encryption. Your custom keys
              will be preserved but inactive. You can re-enable BYOK later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisable}>
              {isDisabling ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Disable BYOK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
