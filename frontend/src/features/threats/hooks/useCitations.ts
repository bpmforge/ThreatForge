import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCitationsForThreat,
  getCitationsForMitigation,
  overrideCitation,
} from "../services/citation-api";
import type { VerificationStatus } from "../types";

export function useCitations(
  modelId: string | undefined,
  ownerType: "threat" | "mitigation",
  ownerId: string | undefined,
  open: boolean,
) {
  const qc = useQueryClient();
  const key = ["citations", modelId, ownerType, ownerId];

  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      ownerType === "threat"
        ? getCitationsForThreat(modelId!, ownerId!)
        : getCitationsForMitigation(modelId!, ownerId!),
    enabled: open && !!modelId && !!ownerId,
    staleTime: 30_000,
  });

  const override = useMutation({
    mutationFn: (vars: {
      citationId: string;
      status: VerificationStatus;
      rationale: string;
    }) =>
      overrideCitation(modelId!, ownerType, ownerId!, vars.citationId, {
        status: vars.status,
        rationale: vars.rationale,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { citations: query.data ?? [], isLoading: query.isLoading, override };
}
