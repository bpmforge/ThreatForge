# ThreatForge — Threat Model Creation Sequence Diagrams

_Derived from `docs/sdlc/SEQUENCE_DIAGRAMS.md`. Covers the primary write flows: create model, AI threat suggestion, document import, version history, and template use._

---

## 1. Create Threat Model + AI Threat Suggestion

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant NextJS as Next.js
    participant Fastify as Fastify API
    participant PG as PostgreSQL
    participant BullMQ as BullMQ Queue
    participant Worker as AI Worker
    participant AI as AI Provider (Claude/OpenAI)

    User->>Browser: Click "New Model", fill form, submit
    Browser->>NextJS: POST /api/threat-models
    NextJS->>Fastify: POST /api/threat-models (proxy)
    Fastify->>Fastify: checkOrganizationAccess(userId, orgId)
    Fastify->>PG: INSERT ThreatModel { name, methodology, orgId }
    PG-->>Fastify: ThreatModel { id }
    Fastify->>PG: INSERT AuditLog { action: CREATE, entity: ThreatModel }
    Fastify-->>Browser: 201 { data: { id, name } }
    Browser->>Browser: Navigate to /models/:id (canvas)

    User->>Browser: Drag components onto canvas, draw connections
    Browser->>Browser: canvasStore.addNode / addEdge
    Browser->>Fastify: POST /api/threat-models/:id/save-canvas { nodes, edges }
    Fastify->>PG: updateMany ThreatModel SET canvasState = ?
    Fastify->>Fastify: syncCanvasToDatabase(id, canvasState)
    Fastify->>PG: upsert Components (from nodes)
    Fastify->>PG: upsert Connections (from edges)
    Fastify-->>Browser: 200 { success: true }

    User->>Browser: Click "Suggest Threats" (AI tab)
    Browser->>Fastify: POST /api/ai/suggest-threats { modelId, methodology }
    Fastify->>PG: SELECT Components WHERE threatModelId = ?
    Fastify->>PG: INSERT AiJob { type: SUGGEST_THREATS, status: PENDING }
    Fastify->>BullMQ: queue.add("suggest-threats", { jobId, modelId })
    Fastify-->>Browser: 202 { jobId }

    Browser->>Browser: Start polling GET /api/ai-jobs/:jobId every 2s

    BullMQ->>Worker: Process job { jobId, modelId }
    Worker->>PG: SELECT Components, Connections, canvasState
    loop Per component per category
        Worker->>AI: Chat completion { system prompt + component context + CWE refs }
        AI-->>Worker: Threat list with severity and rationale
        Worker->>Worker: confidence check (>= threshold or retry up to 3x)
        Worker->>PG: INSERT Threats { status: AI_SUGGESTED, componentId }
    end
    Worker->>PG: UPDATE AiJob { status: COMPLETED, result: { count } }

    Browser->>Fastify: GET /api/ai-jobs/:jobId
    Fastify->>PG: SELECT AiJob WHERE id = ?
    Fastify-->>Browser: 200 { status: COMPLETED }
    Browser->>Fastify: GET /api/threats?modelId=:id
    Fastify-->>Browser: 200 { data: [Threat...] }
    Browser->>Browser: Render threats in Threats panel
```

---

## 2. Document Import → AI Extraction → Canvas Merge

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Fastify as Fastify API
    participant ExtAgent as Extraction Agent
    participant AI as AI Provider
    participant MergeEngine as Merge Engine
    participant PG as PostgreSQL

    User->>Browser: Upload SRS/SAD document (PDF/DOCX/MD)
    Browser->>Fastify: POST /api/threat-models/:id/import-documents (multipart)
    Fastify->>PG: INSERT Document { name, type, content }
    Fastify->>PG: INSERT AiJob { type: EXTRACT_DOCUMENT }
    Fastify-->>Browser: 202 { jobId }

    Fastify->>ExtAgent: orchestrate({ documentId, modelId })
    ExtAgent->>AI: Detect document type (SRS/SAD/IaC/OpenAPI)
    AI-->>ExtAgent: DocumentType = SRS
    ExtAgent->>AI: Extract components prompt (with existing canvas summary)
    AI-->>ExtAgent: { components[], connections[], boundaries[], requirements[] }
    ExtAgent->>AI: Extract threats from prose
    AI-->>ExtAgent: { threats[] }

    ExtAgent->>MergeEngine: mergeWithCanvas(extracted, existingComponents)
    MergeEngine->>MergeEngine: fuzzyMatch(extracted.name, existing.name)
    MergeEngine->>MergeEngine: Classify each as ADD / UPDATE / SKIP with confidence
    MergeEngine-->>ExtAgent: MergeProposal { adds[], updates[], skips[] }

    ExtAgent->>PG: UPDATE AiJob { status: AWAITING_REVIEW, result: MergeProposal }
    Browser->>Fastify: GET /api/ai-jobs/:jobId
    Fastify-->>Browser: 200 { status: AWAITING_REVIEW, result: MergeProposal }
    Browser->>Browser: Open MergeReviewDialog

    User->>Browser: Review adds/updates/skips, confirm
    Browser->>Fastify: POST /api/threat-models/:id/apply-merge { approved }
    Fastify->>PG: INSERT/UPDATE Components, Connections, Boundaries
    Fastify->>PG: INSERT Requirements (extracted from SRS)
    Fastify->>PG: INSERT Threats { status: AI_SUGGESTED }
    Fastify->>Fastify: syncCanvasToDatabase (recalculate layout)
    Fastify-->>Browser: 200 { canvasState: updatedCanvas }
    Browser->>Browser: Update canvasStore → React Flow re-renders
```

---

## 3. Human-in-the-Loop Threat Review

```mermaid
sequenceDiagram
    actor SecEng as Security Engineer
    actor Dev as Developer
    participant Browser
    participant Fastify as Fastify API
    participant PG as PostgreSQL
    participant Notif as Notification Service

    Note over Fastify, PG: AI Suggestion already created Threat { status: AI_SUGGESTED }

    SecEng->>Browser: Open threat panel, review AI suggestion
    Browser->>Fastify: GET /api/threats?modelId=:id&status=AI_SUGGESTED
    Fastify-->>Browser: 200 { data: [Threat { id, title, severity, rationale }] }

    alt Accept threat as-is
        SecEng->>Browser: Click Accept
        Browser->>Fastify: PATCH /api/threats/:id { status: ACCEPTED }
        Fastify->>PG: UPDATE Threat SET status = ACCEPTED
        Fastify->>PG: INSERT AuditLog { action: ACCEPT_THREAT }
    else Modify and accept
        SecEng->>Browser: Edit title/severity, click Accept
        Browser->>Fastify: PATCH /api/threats/:id { status: MODIFIED, title, severity }
        Fastify->>PG: UPDATE Threat SET status = MODIFIED, title, severity
    else Reject
        SecEng->>Browser: Click Reject with reason
        Browser->>Fastify: PATCH /api/threats/:id { status: REJECTED, rejectionReason }
        Fastify->>PG: UPDATE Threat SET status = REJECTED
    end

    SecEng->>Browser: Assign mitigation to developer
    Browser->>Fastify: POST /api/reviews { threatId, assigneeId, modelId }
    Fastify->>PG: INSERT ReviewRequest { threatId, assigneeId, status: PENDING }
    Fastify->>Notif: notify(assigneeId, "New review request")
    Notif->>Dev: Email / Slack notification

    Dev->>Browser: Open /reviews, find assigned threat
    Dev->>Browser: Add evidence link { type: ticket, url, title }
    Browser->>Fastify: PATCH /api/mitigations/:id/evidence { type, url, title }
    Fastify->>PG: UPDATE Mitigation SET evidenceLinks = [...links]
    Dev->>Browser: Mark mitigation as IMPLEMENTED
    Browser->>Fastify: PATCH /api/mitigations/:id { status: IMPLEMENTED }
    Fastify->>PG: UPDATE Mitigation SET status = IMPLEMENTED, implementedAt
    Fastify-->>Browser: 200 { data: Mitigation }
```

---

## 4. Version History — Snapshot and Restore

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Fastify as Fastify API
    participant PG as PostgreSQL

    Note over User, PG: Create snapshot

    User->>Browser: Click History → Save Version
    Browser->>Browser: Open "Save Version" dialog, enter description
    Browser->>Fastify: POST /api/threat-models/:id/versions { name, changesSummary }
    Fastify->>PG: SELECT MAX(version) FROM ThreatModelVersion WHERE threatModelId = :id
    Fastify->>PG: INSERT ThreatModelVersion { version: max+1, canvasState: current, changesSummary }
    Fastify-->>Browser: 201 { id, version, name, changesSummary, createdAt }
    Browser->>Browser: Update version list in History panel

    Note over User, PG: Restore version

    User->>Browser: Click version in history, click Restore
    Browser->>Fastify: POST /api/threat-models/:id/versions/:versionId/restore
    Fastify->>PG: Fetch current ThreatModel + target version
    Fastify->>PG: Auto-save current state as version (max+1): "Pre-restore snapshot"
    Fastify->>PG: UPDATE ThreatModel SET canvasState = versionToRestore.canvasState
    Fastify->>Fastify: syncCanvasToDatabase (rebuild Component/Connection tables)
    Fastify-->>Browser: 201 { version, changesSummary: "Restored from Version X" }
    Browser->>Browser: canvasStore.loadCanvas(restored canvasState) → React Flow re-renders
```

---

## 5. Model Template: Save and Instantiate

```mermaid
sequenceDiagram
    actor SecArch as Security Architect
    actor DevTeam as Developer
    participant Browser
    participant Fastify as Fastify API
    participant PG as PostgreSQL

    Note over SecArch: Save mature threat model as reusable template

    SecArch->>Browser: Open model, click "Save as Template"
    Browser->>Browser: Open SaveAsTemplateDialog
    SecArch->>Browser: Fill name, category, description, toggle includeThreats
    Browser->>Fastify: POST /api/v1/threat-models/:id/save-as-template
    Fastify->>PG: SELECT ThreatModel + Components + Connections + Threats (if includeThreats)
    Fastify->>PG: INSERT ModelTemplate { canvasState, components, threats, organizationId }
    Fastify-->>Browser: 201 { id, name, componentCount, threatCount }
    Browser->>Browser: Toast "Template saved"

    Note over DevTeam: New project — start from template

    DevTeam->>Browser: Navigate to /templates, select project
    Browser->>Fastify: GET /api/v1/model-templates?orgId=:id
    Fastify-->>Browser: 200 { data: [ModelTemplate...] }

    DevTeam->>Browser: Click "Use Template", enter model name
    Browser->>Fastify: POST /api/v1/threat-models/from-template/:templateId { projectId, name }
    Fastify->>PG: SELECT ModelTemplate WHERE id = templateId
    Fastify->>PG: INSERT ThreatModel { name, projectId, canvasState from template }
    Fastify->>PG: INSERT Components (cloned from template)
    Fastify->>PG: INSERT Threats { status: AI_SUGGESTED } (if template had threats)
    Fastify->>PG: UPDATE ModelTemplate SET usageCount += 1
    Fastify-->>Browser: 201 { id: newModelId, componentCount, threatCount }
    Browser->>Browser: Navigate to /models/:newModelId
```
