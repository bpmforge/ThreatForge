/**
 * Map a route pattern onto concrete ids from the cross-tenant seed
 * (cross-tenant-seed.ts): each `:param` becomes one of org B's resources, or a
 * literal, chosen from the param name and the path before it. Returns null
 * when a param cannot be mapped, so callers can record the route instead of
 * guessing.
 */

/** Route param → seeded B resource key, or a literal value. */
const PARAM_KEYS: Record<string, string> = {
  orgId: "org",
  organizationId: "org",
  projectId: "project",
  modelId: "model",
  threatModelId: "model",
  threatId: "threat",
  mitigationId: "mitigation",
  dfdId: "dfd",
  processId: "dfdProcess",
  dataStoreId: "dfdDataStore",
  entityId: "dfdEntity",
  flowId: "dfdFlow",
  dataFlowId: "dfdFlow",
  seqId: "sequence",
  partId: "participant",
  msgId: "message",
  reviewId: "review",
  storyId: "story",
  chainId: "chain",
  mid: "archMitigation",
  docId: "document",
  citationId: "citation",
  versionId: "version",
  accessId: "modelAccess",
  shareId: "modelAccess",
  evidenceId: "evidence",
  scanId: "scan",
  findingId: "finding",
  webhookId: "webhook",
  integrationId: "integration",
  jobId: "job",
  roleId: "role",
  invitationId: "invitation",
  tokenId: "apiToken",
  keyId: "ciKey",
  promptId: "prompt",
  docTypeId: "docType",
  pipelineId: "pipeline",
  stageId: "stage",
  executionId: "execution",
  logId: "promptLog",
  providerId: "provider",
  notificationId: "notification",
  sessionId: "session",
  userId: "ownerUser",
  frameworkId: "riskFramework",
};

const LITERALS: Record<string, string> = {
  framework: "SOC2",
  controlId: "CC6.1",
  categoryId: "CC6",
  version: "1",
  provider: "openai",
  issueKey: "B-1",
  traceId: "trace-b",
};

/** Resolve one param from the path text before it; null when unmapped. */
function resolveParam(
  before: string,
  param: string,
  b: Record<string, string>,
): string | null {
  const last = (re: RegExp) => re.test(before);
  if (param === "libraryId") {
    if (last(/mitigation-libraries\/$/)) return b.mitigationLibrary;
    if (last(/component-templates\/$/)) return b.componentLibrary;
    if (last(/threat-libraries\/$/)) return b.threatLibrary;
    return null;
  }
  if (param === "templateId") {
    if (before.includes("mitigation-libraries")) return b.mitigationTemplate;
    if (before.includes("component-templates")) return b.componentTemplate;
    if (before.includes("threat-libraries")) return b.threatTemplate;
    if (before.includes("from-template")) return b.modelTemplate;
    return null;
  }
  if (param === "memberId") {
    return before.includes("/projects/") ? b.projectMember : b.ownerMembership;
  }
  if (param === "membershipId") return b.ownerMembership;
  if (param === "commentId") {
    return before.includes("/reviews/") ? b.reviewComment : b.threatComment;
  }
  if (param === "id") {
    const coll = before.match(/\/([\w-]+)\/$/)?.[1];
    const byColl: Record<string, string> = {
      "threat-models": "model",
      organizations: "org",
      projects: "project",
      threats: "threat",
      mitigations: "mitigation",
      requirements: "requirement",
      "model-templates": "modelTemplate",
      "custom-categories": "customCategory",
      libraries: "mitigationLibrary",
      subscriptions: "subscription",
      "risk-frameworks": "riskFramework",
    };
    const key = coll ? byColl[coll] : undefined;
    return key ? b[key] : null;
  }
  if (param in LITERALS) return LITERALS[param];
  const key = PARAM_KEYS[param];
  return key ? b[key] : null;
}

export function buildUrl(
  url: string,
  b: Record<string, string>,
): string | null {
  let out = "";
  let rest = url;
  for (;;) {
    const m = rest.match(/:(\w+)/);
    if (!m || m.index === undefined) return out + rest;
    const before = out + rest.slice(0, m.index);
    const value = resolveParam(before, m[1], b);
    if (value === null) return null;
    out = before + encodeURIComponent(value);
    rest = rest.slice(m.index + m[0].length);
  }
}
