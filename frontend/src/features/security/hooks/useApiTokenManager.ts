import { useState } from "react";
import { toast } from "sonner";
import {
  useApiTokens,
  useApiTokenScopes,
  useCreateApiToken,
  useDeleteApiToken,
} from "./useApiTokens";

export function formatDate(dateString: string | null): string {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function isExpired(dateString: string | null): boolean {
  if (!dateString) return false;
  return new Date(dateString) < new Date();
}

function calculateExpiresAt(expiresIn: string): string | undefined {
  if (expiresIn === "never") return undefined;
  const date = new Date();
  switch (expiresIn) {
    case "7days":
      date.setDate(date.getDate() + 7);
      break;
    case "30days":
      date.setDate(date.getDate() + 30);
      break;
    case "90days":
      date.setDate(date.getDate() + 90);
      break;
    case "1year":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  return date.toISOString();
}

export function useApiTokenManager() {
  const { data: tokens = [], isLoading: isLoadingTokens } = useApiTokens();
  const { data: availableScopes = [], isLoading: isLoadingScopes } =
    useApiTokenScopes();
  const createToken = useCreateApiToken();
  const deleteToken = useDeleteApiToken();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [showNewTokenDialog, setShowNewTokenDialog] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiresIn, setExpiresIn] = useState<string>("never");

  const isLoading = isLoadingTokens || isLoadingScopes;
  const activeTokens = tokens.filter(
    (t) => t.isActive && !isExpired(t.expiresAt),
  );
  const inactiveTokens = tokens.filter(
    (t) => !t.isActive || isExpired(t.expiresAt),
  );

  function handleCreateToken() {
    if (!tokenName.trim()) {
      toast.error("Token name is required");
      return;
    }
    if (selectedScopes.length === 0) {
      toast.error("Select at least one scope");
      return;
    }
    createToken.mutate(
      {
        name: tokenName.trim(),
        scopes: selectedScopes,
        expiresAt: calculateExpiresAt(expiresIn),
      },
      {
        onSuccess: (data) => {
          setNewToken(data.token);
          setShowCreateDialog(false);
          setShowNewTokenDialog(true);
          setTokenName("");
          setSelectedScopes([]);
          setExpiresIn("never");
        },
      },
    );
  }

  function handleDeleteToken() {
    if (!showDeleteDialog) return;
    deleteToken.mutate(showDeleteDialog, {
      onSuccess: () => setShowDeleteDialog(null),
    });
  }

  function copyToken() {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setCopied(true);
      toast.success("Token copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  return {
    isLoading,
    activeTokens,
    inactiveTokens,
    availableScopes,
    showCreateDialog,
    setShowCreateDialog,
    showDeleteDialog,
    setShowDeleteDialog,
    showNewTokenDialog,
    setShowNewTokenDialog,
    newToken,
    setNewToken,
    copied,
    tokenName,
    setTokenName,
    selectedScopes,
    expiresIn,
    setExpiresIn,
    createToken,
    deleteToken,
    handleCreateToken,
    handleDeleteToken,
    copyToken,
    toggleScope,
  };
}
