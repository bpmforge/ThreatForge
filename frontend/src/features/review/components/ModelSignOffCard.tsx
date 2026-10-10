"use client";

import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAttestations,
  useCreateAttestation,
} from "../hooks/useAttestations";

interface ModelSignOffCardProps {
  modelId: string;
}

/**
 * Model-level sign-off / attestation (#57). Shows the most recent attestation
 * and lets a user with edit access attest the model is complete as of now,
 * optionally anchored to a release ref. The latest attestation's timestamp is
 * the baseline for the delta-since-sign-off view (#61).
 */
export function ModelSignOffCard({ modelId }: ModelSignOffCardProps) {
  const { data: attestations } = useAttestations(modelId);
  const createAttestation = useCreateAttestation(modelId);
  const [open, setOpen] = useState(false);
  const [releaseRef, setReleaseRef] = useState("");
  const [summary, setSummary] = useState("");

  const latest = attestations?.[0];

  const handleSignOff = () => {
    createAttestation.mutate(
      {
        releaseRef: releaseRef.trim() || undefined,
        summary: summary.trim() || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setReleaseRef("");
          setSummary("");
        },
      },
    );
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Sign-off
        </h4>
        {!open && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setOpen(true)}
          >
            Sign off
          </Button>
        )}
      </div>

      {latest ? (
        <p className="text-xs text-muted-foreground">
          Last attested by{" "}
          <span className="font-medium text-foreground">
            {latest.attestedBy?.name ?? latest.attestedBy?.email ?? "a user"}
          </span>{" "}
          on{" "}
          {new Date(latest.attestedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {latest.releaseRef ? ` for ${latest.releaseRef}` : ""}.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          No sign-off yet. Attest this model is complete for a release.
        </p>
      )}

      {open && (
        <div className="space-y-2 pt-1">
          <Input
            value={releaseRef}
            onChange={(e) => setReleaseRef(e.target.value)}
            placeholder="Release ref (optional, e.g. v2.3.0)"
            className="h-7 text-xs"
            aria-label="Release reference"
          />
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Attestation note (optional)"
            className="min-h-[48px] text-xs resize-none"
            aria-label="Attestation summary"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={createAttestation.isPending}
              onClick={handleSignOff}
            >
              {createAttestation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <ShieldCheck className="h-3 w-3 mr-1" />
              )}
              Confirm sign-off
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
