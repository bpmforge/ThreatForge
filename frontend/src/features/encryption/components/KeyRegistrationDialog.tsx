"use client";

import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { useEncryptionMutations } from "../hooks/useEncryption";
import type { EncryptionAlgorithm } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface KeyRegistrationDialogProps {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RegistrationMode = "generate" | "passphrase" | "custom";

export function KeyRegistrationDialog({
  orgId,
  open,
  onOpenChange,
}: KeyRegistrationDialogProps) {
  const [mode, setMode] = useState<RegistrationMode>("generate");
  const [description, setDescription] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [algorithm, setAlgorithm] =
    useState<EncryptionAlgorithm>("aes-256-gcm");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatedSalt, setGeneratedSalt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { registerKeyAsync, isRegistering } = useEncryptionMutations(orgId);

  const resetForm = () => {
    setDescription("");
    setPassphrase("");
    setCustomKey("");
    setGeneratedKey(null);
    setGeneratedSalt(null);
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleRegister = async () => {
    try {
      let result;
      switch (mode) {
        case "generate":
          result = await registerKeyAsync({
            generateNew: true,
            description: description || undefined,
          });
          if (result.key) {
            setGeneratedKey(result.key);
            toast.success(
              "Key generated! Save it now - it won't be shown again.",
            );
          }
          break;
        case "passphrase":
          if (!passphrase) {
            toast.error("Please enter a passphrase");
            return;
          }
          result = await registerKeyAsync({
            passphrase,
            description: description || undefined,
          });
          if (result.salt) {
            setGeneratedSalt(result.salt);
            toast.success("Key registered! Save the salt for recovery.");
          }
          break;
        case "custom":
          if (!customKey) {
            toast.error("Please enter your key");
            return;
          }
          result = await registerKeyAsync({
            key: customKey,
            algorithm,
            description: description || undefined,
          });
          toast.success("Custom key registered");
          handleClose();
          break;
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to register key"));
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show generated key/salt result
  if (generatedKey || generatedSalt) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Key Registered Successfully</DialogTitle>
            <DialogDescription>
              Save this information securely. It will not be shown again.
            </DialogDescription>
          </DialogHeader>

          <Alert
            variant="destructive"
            className="border-orange-500 bg-orange-50 dark:bg-orange-950/20"
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Copy and store this securely. You will
              need it to decrypt your data.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {generatedKey && (
              <div className="space-y-1">
                <Label>Encryption Key</Label>
                <div className="flex gap-2">
                  <Textarea
                    value={generatedKey}
                    readOnly
                    className="font-mono text-xs"
                    rows={3}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(generatedKey)}
                    aria-label="Copy key"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {generatedSalt && (
              <div className="space-y-1">
                <Label>Recovery Salt</Label>
                <div className="flex gap-2">
                  <Input
                    value={generatedSalt}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(generatedSalt)}
                    aria-label="Copy salt"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Store this salt with your passphrase to recover the key.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>I&apos;ve Saved It</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Register Encryption Key</DialogTitle>
          <DialogDescription>
            Choose how you want to create your encryption key
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as RegistrationMode)}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="passphrase">Passphrase</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Generate a secure random key. You&apos;ll need to save it
              securely.
            </p>
            <div className="space-y-1">
              <Label htmlFor="gen-desc">Description (optional)</Label>
              <Input
                id="gen-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Production key 2025"
              />
            </div>
          </TabsContent>

          <TabsContent value="passphrase" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Derive a key from a passphrase. You&apos;ll receive a salt for
              recovery.
            </p>
            <div className="space-y-1">
              <Label htmlFor="pass">Passphrase *</Label>
              <Input
                id="pass"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Strong passphrase"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pass-desc">Description (optional)</Label>
              <Input
                id="pass-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Passphrase-derived key"
              />
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Register your own key (must be valid for the selected algorithm).
            </p>
            <div className="space-y-1">
              <Label htmlFor="custom-key">Your Key *</Label>
              <Textarea
                id="custom-key"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="Base64-encoded key"
                className="font-mono text-xs"
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="algorithm">Algorithm</Label>
              <Select
                value={algorithm}
                onValueChange={(v) => setAlgorithm(v as EncryptionAlgorithm)}
              >
                <SelectTrigger id="algorithm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aes-256-gcm">
                    AES-256-GCM (Recommended)
                  </SelectItem>
                  <SelectItem value="aes-256-cbc">AES-256-CBC</SelectItem>
                  <SelectItem value="chacha20-poly1305">
                    ChaCha20-Poly1305
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cust-desc">Description (optional)</Label>
              <Input
                id="cust-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., HSM-managed key"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isRegistering}
          >
            Cancel
          </Button>
          <Button onClick={handleRegister} disabled={isRegistering}>
            {isRegistering && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {mode === "generate" ? "Generate Key" : "Register Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
