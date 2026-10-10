/**
 * REFRESH_MITIGATIONS LLM-reply shape validation.
 *
 * The refresh job (ai-worker.ts, REFRESH_MITIGATIONS case) used to cast the
 * parsed LLM reply straight to `Array<{...}>` with no runtime check. A reply
 * that parsed as JSON but had the wrong shape ({}, [null], objects missing
 * fields) passed the cast, and the per-threat delete + createMany then ran
 * against garbage — wiping the threat's existing mitigations and inserting
 * broken ones (or none). This module validates the reply BEFORE the caller
 * does anything destructive; on failure the caller must leave the threat's
 * existing mitigations untouched.
 */
import { z } from "zod";

const MitigationReplyItemSchema = z.object({
  description: z.string().min(1),
  controlCategory: z.string(),
  testCriteria: z.string(),
  effort: z.string(),
  effectiveness: z.string(),
});

type MitigationReplyItem = z.infer<typeof MitigationReplyItemSchema>;

const MitigationReplySchema = z.array(MitigationReplyItemSchema).min(1);

export type MitigationRefreshValidation =
  | { ok: true; mitigations: MitigationReplyItem[] }
  | { ok: false; error: string };

/**
 * Parse + shape-validate a REFRESH_MITIGATIONS LLM reply.
 *
 * Rejects: non-JSON text, `{}`, `[null]`, `[{"foo":1}]` (missing required
 * fields), and `[]` (an empty array is treated as a malformed/degenerate
 * reply, not "no mitigations needed" — a valid refresh always produces 2-4
 * mitigations per the prompt contract).
 */
export function validateMitigationRefreshReply(
  raw: string,
): MitigationRefreshValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "reply is not valid JSON" };
  }

  const result = MitigationReplySchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: `reply does not match the expected mitigation array shape: ${result.error.message}`,
    };
  }

  return { ok: true, mitigations: result.data };
}
