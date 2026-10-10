/**
 * Persist deterministically-extracted sequence diagrams to the database.
 *
 * Runs at document-import time. Every diagram becomes a SequenceDiagram row
 * with its participants and messages. Participant `componentId` is
 * fuzzy-matched against existing canvas components — exact / containment /
 * high-overlap matches link automatically; below-threshold participants stay
 * unlinked for manual review.
 *
 * Append-only, no dedup: re-uploading a document re-runs this path and
 * appends fresh diagrams. Users prune manually. This is intentional —
 * name-match dedup would silently discard a re-upload that legitimately
 * updated a "Login" flow with new steps. A hash-based dedup would require
 * a schema change, which is out of scope.
 */

import type { PrismaClient } from "@prisma/client";
import {
  buildLinkResolver,
  DEFAULT_LINK_THRESHOLD,
  type LinkResult,
} from "./component-linker.js";
import type { ExtractedSequenceDiagram } from "./types.js";

export interface PersistedSequenceDiagram {
  id: string;
  name: string;
  participantCount: number;
  messageCount: number;
  /** How many participants got auto-linked to canvas components. */
  linkedParticipantCount: number;
}

export interface PersistOptions {
  threatModelId: string;
  userId: string;
  /** Optional override for the auto-link confidence threshold (default 0.7). */
  linkThreshold?: number;
  /**
   * Optional pre-built resolver — useful for tests so they don't have to
   * mock prisma.component.findMany. When omitted, the function builds one
   * from the database.
   */
  linkResolver?: (label: string) => LinkResult;
}

export async function persistExtractedSequences(
  prisma: PrismaClient,
  diagrams: ExtractedSequenceDiagram[],
  opts: PersistOptions,
): Promise<PersistedSequenceDiagram[]> {
  if (diagrams.length === 0) return [];

  const existingCount = await prisma.sequenceDiagram.count({
    where: { threatModelId: opts.threatModelId },
  });

  const resolveLink =
    opts.linkResolver ??
    (await buildLinkResolver(
      prisma,
      opts.threatModelId,
      opts.linkThreshold ?? DEFAULT_LINK_THRESHOLD,
    ));

  const persisted: PersistedSequenceDiagram[] = [];
  let order = existingCount;

  for (const d of diagrams) {
    const diagram = await prisma.sequenceDiagram.create({
      data: {
        name: d.name,
        description: d.description ?? null,
        order: order++,
        threatModelId: opts.threatModelId,
        createdById: opts.userId,
      },
    });

    // Participants — fuzzy-link to canvas components when possible.
    const labelToId = new Map<string, string>();
    let linkedParticipantCount = 0;
    for (const p of d.participants) {
      const link = resolveLink(p.label);
      if (link.nodeId) linkedParticipantCount++;
      const row = await prisma.sequenceParticipant.create({
        data: {
          label: p.label,
          order: p.order,
          sequenceDiagramId: diagram.id,
          componentId: link.nodeId ?? null,
        },
      });
      labelToId.set(p.label, row.id);
    }

    // Messages — collapse our three-value messageType into the SYNC+isReturn
    // convention the rest of the app expects. Leave notes null — the raw
    // Mermaid/PlantUML line is redundant with the message label and clutters
    // the UI.
    let messageCount = 0;
    for (const m of d.messages) {
      const fromId = labelToId.get(m.from);
      const toId = labelToId.get(m.to);
      if (!fromId || !toId) continue;

      const isReturn = m.isReturn || m.messageType === "RETURN";
      const storedType = m.messageType === "ASYNC" ? "ASYNC" : "SYNC";

      await prisma.sequenceMessage.create({
        data: {
          label: m.label,
          order: m.order,
          messageType: storedType,
          isReturn,
          sequenceDiagramId: diagram.id,
          fromId,
          toId,
        },
      });
      messageCount++;
    }

    persisted.push({
      id: diagram.id,
      name: diagram.name,
      participantCount: d.participants.length,
      messageCount,
      linkedParticipantCount,
    });
  }

  return persisted;
}
