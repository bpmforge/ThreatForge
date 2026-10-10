"use client";

import {
  Key,
  Plus,
  Trash2,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { CreateTokenDialog } from "./CreateTokenDialog";
import {
  useApiTokenManager,
  formatDate,
  isExpired,
} from "../hooks/useApiTokenManager";

export function ApiTokenManager() {
  const m = useApiTokenManager();

  if (m.isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Tokens
              </CardTitle>
              <CardDescription>
                Create and manage personal access tokens for API access
              </CardDescription>
            </div>
            <Button onClick={() => m.setShowCreateDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Token
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {m.activeTokens.length === 0 && m.inactiveTokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API tokens yet</p>
              <p className="text-sm mt-1">
                Create a token to access the API programmatically
              </p>
            </div>
          ) : (
            <>
              {m.activeTokens.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Active Tokens ({m.activeTokens.length})
                  </h4>
                  {m.activeTokens.map((token) => (
                    <div
                      key={token.id}
                      className="p-4 rounded-lg border flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{token.name}</span>
                          <code className="text-xs bg-muted px-2 py-0.5 rounded">
                            {token.tokenPrefix}...
                          </code>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            Used {token.usageCount} time
                            {token.usageCount !== 1 ? "s" : ""}
                          </span>
                          {token.expiresAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires {formatDate(token.expiresAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {token.scopes.slice(0, 3).map((scope) => (
                            <Badge
                              key={scope}
                              variant="secondary"
                              className="text-xs"
                            >
                              {scope}
                            </Badge>
                          ))}
                          {token.scopes.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{token.scopes.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => m.setShowDeleteDialog(token.id)}
                        aria-label={`Delete token ${token.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {m.inactiveTokens.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Expired/Revoked ({m.inactiveTokens.length})
                  </h4>
                  {m.inactiveTokens.map((token) => (
                    <div
                      key={token.id}
                      className="p-4 rounded-lg border bg-muted/50 flex items-center justify-between opacity-60"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium line-through">
                            {token.name}
                          </span>
                          <Badge variant="destructive" className="text-xs">
                            {isExpired(token.expiresAt) ? "Expired" : "Revoked"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Created {formatDate(token.createdAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => m.setShowDeleteDialog(token.id)}
                        aria-label={`Delete token ${token.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CreateTokenDialog
        open={m.showCreateDialog}
        tokenName={m.tokenName}
        expiresIn={m.expiresIn}
        selectedScopes={m.selectedScopes}
        availableScopes={m.availableScopes}
        isPending={m.createToken.isPending}
        onNameChange={m.setTokenName}
        onExpiresChange={m.setExpiresIn}
        onToggleScope={m.toggleScope}
        onSubmit={m.handleCreateToken}
        onClose={() => m.setShowCreateDialog(false)}
      />

      {/* New Token Display Dialog */}
      <Dialog
        open={m.showNewTokenDialog}
        onOpenChange={m.setShowNewTokenDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-green-600">Token Created</DialogTitle>
            <DialogDescription>
              Copy your token now. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              This token will only be shown once. Copy it now and store it
              securely.
            </AlertDescription>
          </Alert>

          <div className="relative">
            <code className="block bg-muted p-3 rounded-lg text-sm font-mono break-all pr-12">
              {m.newToken}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={m.copyToken}
              aria-label="Copy token"
            >
              {m.copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                m.setShowNewTokenDialog(false);
                m.setNewToken(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!m.showDeleteDialog}
        onOpenChange={() => m.setShowDeleteDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Token</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The token will be permanently
              deleted and any applications using it will lose access.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => m.setShowDeleteDialog(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={m.handleDeleteToken}
              disabled={m.deleteToken.isPending}
            >
              {m.deleteToken.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
