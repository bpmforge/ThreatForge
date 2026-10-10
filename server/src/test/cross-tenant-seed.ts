/**
 * Seed for the cross-tenant suite (src/__tests__/cross-tenant.test.ts).
 *
 * Org A has one OWNER (the outsider). Org B owns one of every resource an
 * id-bearing route can name, plus an OWNER (positive control) and a
 * SUSPENDED ADMIN. Returns B's ids keyed by resource name; the suite maps
 * route params onto these keys.
 */
import type { PrismaClient } from "@prisma/client";

export interface CrossTenantSeed {
  users: {
    outsider: string;
    ownerB: string;
    suspendedB: string;
    adminB: string;
    editorB: string;
    viewerB: string;
  };
  /** Org B's resource ids, keyed by resource name. */
  b: Record<string, string>;
}

export async function seedCrossTenant(
  prisma: PrismaClient,
): Promise<CrossTenantSeed> {
  const stamp = Date.now();
  const user = (tag: string) =>
    prisma.user.create({
      data: { email: `${tag}-${stamp}@xt.test`, name: tag },
    });
  const outsider = await user("outsider-a");
  const ownerB = await user("owner-b");
  const suspendedB = await user("suspended-b");
  const pendingB = await user("pending-b");
  const adminB = await user("admin-b");
  const editorB = await user("editor-b");
  const viewerB = await user("viewer-b");

  const orgA = await prisma.organization.create({
    data: { name: "Org A", slug: `xt-a-${stamp}`, ownerId: outsider.id },
  });
  const orgB = await prisma.organization.create({
    data: { name: "Org B", slug: `xt-b-${stamp}`, ownerId: ownerB.id },
  });
  await prisma.membership.create({
    data: { userId: outsider.id, organizationId: orgA.id, role: "OWNER" },
  });
  const ownerMembership = await prisma.membership.create({
    data: { userId: ownerB.id, organizationId: orgB.id, role: "OWNER" },
  });
  for (const [u, role] of [
    [adminB, "ADMIN"],
    [editorB, "EDITOR"],
    [viewerB, "VIEWER"],
  ] as const) {
    await prisma.membership.create({
      data: { userId: u.id, organizationId: orgB.id, role },
    });
  }
  const suspended = await prisma.membership.create({
    data: {
      userId: suspendedB.id,
      organizationId: orgB.id,
      role: "ADMIN",
      status: "SUSPENDED",
    },
  });
  const invitation = await prisma.membership.create({
    data: {
      userId: pendingB.id,
      organizationId: orgB.id,
      role: "VIEWER",
      status: "PENDING",
      invitedById: ownerB.id,
      invitedAt: new Date(),
    },
  });

  const org = orgB.id;
  const by = ownerB.id;
  const project = await prisma.project.create({
    data: { name: "B project", organizationId: org, createdById: by },
  });
  const model = await prisma.threatModel.create({
    data: { name: "B model", projectId: project.id, createdById: by },
  });
  const threatModelId = model.id;
  const threat = await prisma.threat.create({
    data: { name: "B threat", threatModelId, createdById: by },
  });
  const mitigation = await prisma.mitigation.create({
    data: { description: "B mitigation", threatId: threat.id, createdById: by },
  });
  const component = await prisma.component.create({
    data: {
      nodeId: "b-node",
      type: "SERVICE",
      name: "B service",
      positionX: 0,
      positionY: 0,
      threatModelId,
    },
  });

  const dfd = await prisma.dataFlowDiagram.create({
    data: { name: "B dfd", threatModelId },
  });
  const at = { positionX: 0, positionY: 0, dfdId: dfd.id };
  const process = await prisma.dFDProcess.create({
    data: { nodeId: "p1", number: "1", name: "B process", ...at },
  });
  const dataStore = await prisma.dFDDataStore.create({
    data: { nodeId: "d1", number: "D1", name: "B store", ...at },
  });
  const entity = await prisma.dFDExternalEntity.create({
    data: { nodeId: "e1", name: "B entity", entityType: "USER", ...at },
  });
  const flow = await prisma.dFDDataFlow.create({
    data: { edgeId: "f1", name: "B flow", dfdId: dfd.id },
  });

  const seq = await prisma.sequenceDiagram.create({
    data: { name: "B seq", threatModelId, createdById: by },
  });
  const part = await prisma.sequenceParticipant.create({
    data: { label: "B part", order: 0, sequenceDiagramId: seq.id },
  });
  const msg = await prisma.sequenceMessage.create({
    data: {
      label: "B msg",
      order: 0,
      sequenceDiagramId: seq.id,
      fromId: part.id,
      toId: part.id,
    },
  });

  const review = await prisma.reviewRequest.create({
    data: {
      threatModelId,
      threatModelName: model.name,
      version: 1,
      requestedById: by,
      requestedByName: "owner-b",
    },
  });
  const reviewComment = await prisma.reviewComment.create({
    data: {
      reviewRequestId: review.id,
      userId: by,
      userName: "owner-b",
      content: "B comment",
    },
  });
  const threatComment = await prisma.threatComment.create({
    data: { body: "B threat comment", threatId: threat.id, authorId: by },
  });
  const projectMember = await prisma.projectMember.create({
    data: { projectId: project.id, userId: by },
  });
  const story = await prisma.userStory.create({
    data: {
      title: "B story",
      asA: "user",
      iWant: "x",
      soThat: "y",
      projectId: project.id,
    },
  });
  const chain = await prisma.attackChain.create({
    data: {
      threatModelId,
      name: "B chain",
      description: "d",
      severity: "HIGH",
      sessionId: "s",
      entryPointId: component.id,
      entryPointName: component.name,
      targetAssetId: component.id,
      targetAssetName: component.name,
    },
  });
  const archMit = await prisma.architecturalMitigation.create({
    data: {
      threatModelId,
      kind: "ADD_WAF",
      title: "B arch",
      proposedChange: "x",
    },
  });
  const doc = await prisma.document.create({
    data: {
      name: "B doc",
      type: "MARKDOWN",
      content: "# B",
      threatModelId,
      importedById: by,
    },
  });
  const citation = await prisma.citation.create({
    data: { kind: "DERIVED", citationType: "DOCUMENT", threatId: threat.id },
  });
  const requirement = await prisma.requirement.create({
    data: { reqId: "R-1", text: "B req", threatModelId, createdById: by },
  });
  const version = await prisma.threatModelVersion.create({
    data: { version: 1, canvasState: "{}", threatModelId, createdById: by },
  });
  const access = await prisma.modelAccess.create({
    data: {
      threatModelId,
      organizationId: org,
      accessToken: `xt-${stamp}`,
      grantedById: by,
      guestEmail: "guest@b.test",
    },
  });
  const control = await prisma.controlImplementation.create({
    data: {
      threatModelId,
      framework: "SOC2",
      controlId: "CC6.1",
      controlName: "Logical access",
      createdById: by,
    },
  });
  const evidence = await prisma.controlEvidence.create({
    data: {
      implementationId: control.id,
      evidenceType: "POLICY_DOCUMENT",
      title: "B evidence",
      createdById: by,
    },
  });

  const scan = await prisma.scanRun.create({
    data: { scannerType: "SNYK", projectId: project.id },
  });
  const finding = await prisma.scannerFinding.create({
    data: {
      externalId: "B-1",
      scannerType: "SNYK",
      title: "B finding",
      description: "d",
      severity: "HIGH",
      category: "DEPENDENCY",
      projectId: project.id,
      scanRunId: scan.id,
    },
  });

  const webhook = await prisma.webhook.create({
    data: {
      organizationId: org,
      name: "B hook",
      url: "https://b.example/hook",
      createdById: by,
    },
  });
  const integration = await prisma.integration.create({
    data: {
      organizationId: org,
      type: "JIRA",
      name: "B jira",
      config: "{}",
      createdById: by,
    },
  });
  const job = await prisma.aiJob.create({
    data: {
      userId: by,
      organizationId: org,
      type: "SUGGEST_THREATS",
      input: "{}",
    },
  });
  const role = await prisma.customRole.create({
    data: { organizationId: org, name: "B role" },
  });
  const apiToken = await prisma.apiToken.create({
    data: {
      userId: by,
      name: "B token",
      tokenHash: `xt-hash-${stamp}`,
      tokenPrefix: "ftm_xt",
    },
  });
  const ciKey = await prisma.cIApiKey.create({
    data: {
      name: "B ci key",
      keyHash: `xt-ci-${stamp}`,
      keyPrefix: "ftm_xtci",
      organizationId: org,
      createdById: by,
    },
  });
  const prompt = await prisma.promptTemplate.create({
    data: {
      name: "B prompt",
      category: "ANALYSIS",
      systemPrompt: "s",
      userPromptTemplate: "u",
      organizationId: org,
    },
  });
  const docType = await prisma.documentTypeConfig.create({
    data: {
      name: "B doc type",
      promptTemplateId: prompt.id,
      organizationId: org,
    },
  });
  const pipeline = await prisma.promptPipeline.create({
    data: { name: "B pipeline", organizationId: org },
  });
  const stage = await prisma.pipelineStage.create({
    data: {
      name: "B stage",
      promptTemplateId: prompt.id,
      pipelineId: pipeline.id,
    },
  });
  const execution = await prisma.pipelineExecution.create({
    data: { pipelineId: pipeline.id, userId: by },
  });
  const promptLog = await prisma.promptExecutionLog.create({
    data: {
      promptTemplateId: prompt.id,
      promptTemplateName: prompt.name,
      userId: by,
    },
  });
  const provider = await prisma.aIProvider.create({
    data: {
      name: "B provider",
      type: "OPENAI",
      organizationId: org,
      createdById: by,
    },
  });
  const notification = await prisma.notification.create({
    data: {
      userId: by,
      type: "INFO",
      category: "SYSTEM",
      title: "B note",
      message: "m",
    },
  });
  const session = await prisma.userSession.create({
    data: {
      userId: by,
      sessionToken: `xt-session-${stamp}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });

  const threatLibrary = await prisma.threatLibrary.create({
    data: { name: "B threat lib", organizationId: org },
  });
  const threatTemplate = await prisma.threatTemplate.create({
    data: {
      name: "B threat tpl",
      description: "d",
      strideCategory: "SPOOFING",
      libraryId: threatLibrary.id,
    },
  });
  const mitigationLibrary = await prisma.mitigationLibrary.create({
    data: { name: "B mitigation lib", organizationId: org },
  });
  const mitigationTemplate = await prisma.mitigationTemplate.create({
    data: {
      name: "B mitigation tpl",
      description: "d",
      strategy: "PREVENTION",
      libraryId: mitigationLibrary.id,
    },
  });
  const componentLibrary = await prisma.componentTemplateLibrary.create({
    data: { name: "B component lib", organizationId: org },
  });
  const componentTemplate = await prisma.componentTemplate.create({
    data: {
      name: "B component tpl",
      componentType: "SERVICE",
      libraryId: componentLibrary.id,
    },
  });
  const modelTemplate = await prisma.modelTemplate.create({
    data: {
      name: "B model tpl",
      canvasState: "{}",
      createdById: by,
      organizationId: org,
    },
  });
  const customCategory = await prisma.customThreatCategory.create({
    data: { organizationId: org, name: "B category" },
  });
  const riskFramework = await prisma.riskFramework.create({
    data: { name: "B risk", type: "CVSS", organizationId: org },
  });
  const complianceFramework = await prisma.customComplianceFramework.create({
    data: { name: "B framework", shortName: "BF", organizationId: org },
  });
  const complianceCategory = await prisma.customFrameworkCategory.create({
    data: { frameworkId: complianceFramework.id, name: "B fw category" },
  });
  const subscription = await prisma.librarySubscription.create({
    data: {
      subscriberOrgId: org,
      libraryType: "THREAT_LIBRARY",
      libraryId: threatLibrary.id,
    },
  });

  return {
    users: {
      outsider: outsider.id,
      ownerB: ownerB.id,
      suspendedB: suspendedB.id,
      adminB: adminB.id,
      editorB: editorB.id,
      viewerB: viewerB.id,
    },
    b: {
      org,
      ownerUser: by,
      ownerMembership: ownerMembership.id,
      suspendedMembership: suspended.id,
      invitation: invitation.id,
      project: project.id,
      projectMember: projectMember.id,
      model: threatModelId,
      threat: threat.id,
      mitigation: mitigation.id,
      component: component.id,
      dfd: dfd.id,
      dfdProcess: process.id,
      dfdDataStore: dataStore.id,
      dfdEntity: entity.id,
      dfdFlow: flow.id,
      sequence: seq.id,
      participant: part.id,
      message: msg.id,
      review: review.id,
      reviewComment: reviewComment.id,
      threatComment: threatComment.id,
      story: story.id,
      chain: chain.id,
      archMitigation: archMit.id,
      document: doc.id,
      citation: citation.id,
      requirement: requirement.id,
      version: version.id,
      modelAccess: access.id,
      control: control.id,
      evidence: evidence.id,
      scan: scan.id,
      finding: finding.id,
      webhook: webhook.id,
      integration: integration.id,
      job: job.id,
      role: role.id,
      apiToken: apiToken.id,
      ciKey: ciKey.id,
      prompt: prompt.id,
      docType: docType.id,
      pipeline: pipeline.id,
      stage: stage.id,
      execution: execution.id,
      promptLog: promptLog.id,
      provider: provider.id,
      notification: notification.id,
      session: session.id,
      threatLibrary: threatLibrary.id,
      threatTemplate: threatTemplate.id,
      mitigationLibrary: mitigationLibrary.id,
      mitigationTemplate: mitigationTemplate.id,
      componentLibrary: componentLibrary.id,
      componentTemplate: componentTemplate.id,
      modelTemplate: modelTemplate.id,
      customCategory: customCategory.id,
      riskFramework: riskFramework.id,
      complianceFramework: complianceFramework.id,
      complianceCategory: complianceCategory.id,
      subscription: subscription.id,
    },
  };
}
