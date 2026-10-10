# ThreatForge — Product Vision

**Version:** 1.0  
**Date:** 2026-05-05  
**Audience:** Engineering, product, and prospective enterprise buyers

---

## What ThreatForge Is

ThreatForge is an AI-native threat modeling platform for security architects and the engineering teams they work with. It turns architecture diagrams — whether drawn on the canvas, imported from documents, or extracted from source code — into a living security model: one where threats are identified by AI, reviewed by humans, mapped to compliance frameworks, tracked through remediation, and auditable for regulators.

The key word is **living**. Legacy tools (Microsoft TMT, OWASP Threat Dragon) produce static worksheets. ThreatForge produces a security model that stays connected to the system it describes — updated as architecture changes, re-analyzed as new vulnerabilities emerge, signed off through a review workflow, and linked to tickets in the developer's existing issue tracker.

---

## Who It's For

| Persona | Core Job | What ThreatForge Gives Them |
|---------|----------|----------------------------|
| **Security Architect (Sarah)** | Comprehensive threat model for a complex distributed system | AI-assisted STRIDE/PASTA/ATT&CK analysis, expert 6-pass pipeline, cross-model intelligence |
| **Junior Developer (James)** | First threat model without expert guidance | Guided wizard, STRIDE education, completeness tracker, threat templates |
| **Compliance Officer (Carlos)** | Demonstrate control coverage to auditors | 12 compliance frameworks, requirement traceability, gap analysis, PDF/CSV exports |
| **Product Manager (Paula)** | Understand risk posture for roadmap decisions | Risk dashboard, severity trends, executive summary reports |
| **DevOps Engineer (Derek)** | Integrate threat modeling into CI/CD | API tokens, CI scan endpoints, GitHub Actions support, Terraform/IaC import |
| **Enterprise Admin** | Manage the platform for 500+ users | RBAC, SSO/SAML, SCIM, audit logs, org-level quotas |

---

## The Problem We Solve

Threat modeling is widely accepted as essential security practice and widely avoided in practice. The reasons:

1. **Too slow.** A thorough STRIDE model of a microservices system takes a trained security architect 2–3 days. Teams can't afford that per sprint.
2. **Siloed.** Threat models live in Word documents that go stale the moment the architecture changes.
3. **Expert-gated.** Junior engineers can't do it without hand-holding; experienced architects are the bottleneck.
4. **Compliance-disconnected.** The threat model and the SOC 2 / HIPAA compliance tracker are separate artifacts, maintained separately, diverging constantly.

ThreatForge's answer: make the AI do the first 80% of the threat analysis, make it fast enough to run on every PR, and make the output directly connected to compliance evidence and remediation tracking.

---

## How We Win

### The Three Differentiators

**1. AI that reasons, not AI that lists**  
Our micro-analysis pipeline doesn't generate generic "SQL injection" bullets. It reasons about your specific component types, trust boundaries, data classifications, and sequence flows to generate threats scoped to your architecture. The confidence loop re-prompts when the LLM's confidence is below threshold. Dedup invariants (ADR-006) prevent the AI from flooding the model with near-duplicate threats on re-runs.

**2. Human-in-the-loop, not human-instead-of-the-loop**  
AI suggestions land as `AI_SUGGESTED` and require explicit human review (Accept / Modify / Reject). Modified threats are never overwritten by subsequent AI runs. The review workflow gives teams a formal sign-off trail. Compliance auditors see which threats were AI-generated, which were human-confirmed, and which were rejected with a rationale.

**3. Living model, not a static export**  
Import your SRS. Import your Terraform. Scan your GitHub repo. All of these flow into the same threat model and are version-snapshotted together. When you re-run analysis after a sprint, only components whose architecture hash changed are re-analyzed. The model stays fresh with minimal effort.

---

## Strategic Position

| Competitor | Strength | ThreatForge Advantage |
|-----------|----------|----------------------|
| IriusRisk ($50K+/yr) | Deep compliance libraries | We ship 12 frameworks free; equal coverage. AI is superior (IriusRisk is rule-based). |
| Microsoft TMT (free) | Desktop familiarity | Cloud-native, real-time collab, AI analysis, multi-methodology |
| Threagile (free, open) | YAML-native, CI/CD-first | We have YAML round-trip too, plus AI analysis and a full UI |
| Apiiro | AI-native security posture | We are purpose-built for threat modeling; they are broader but shallower |
| Lucidchart / draw.io | Canvas UX | We are on par (Lucid-Lines LL1-LL4); they have no security semantics |

**The gap we own:** AI-assisted threat modeling with full traceability from architecture document → AI threat → human review → compliance framework → mitigation evidence → audit export. No competitor does the full chain.

---

## 2026-2027 Product Direction

### 2026-H2: Enterprise-Grade Foundation

The next two quarters harden ThreatForge for regulated buyers (FedRAMP, HIPAA, SOC 2 Type II) and make the AI pipeline production-quality:

- **AI pipeline correctness** — Wave A-E: human-edit preservation, incremental re-analysis, streaming persistence, selective scans, JSON safety
- **Encryption at rest** — AES-256-GCM field-level encryption for threat model data (FedRAMP P0)
- **Cloud-native deployment** — GCP and AWS reference architectures; Kubernetes Helm chart; managed DB/Redis support
- **SCIM provisioning** — automated user lifecycle for enterprise identity teams
- **LLM Citation Verifier** — every AI claim traceable to a document section, CWE, or OWASP reference
- **Customizable reports + DOCX export** — brand-able reports for compliance packages
- **Lucidchart structural parity** — rich text, swimlanes, layers, shape rotation (V2)

### 2027: Intelligence Platform

Once the enterprise foundation is solid, ThreatForge becomes an intelligence layer across an organization's entire application portfolio:

- **Cross-portfolio risk intelligence** — systemic threat patterns across all threat models in an org
- **Agentic threat modeling** — AI that asks clarifying questions, runs multi-pass attack-chain analysis, proposes architectural mitigations (not just control mitigations)
- **SDK + CLI** — `ftm validate model.yaml` fails CI on unmitigated CRITICAL threats
- **Marketplace** — community threat libraries, component templates, compliance packs

---

## What Winning Looks Like

By end of 2026:

- A regulated enterprise (healthcare, finance) can purchase ThreatForge with confidence that FedRAMP and HIPAA controls are satisfied by the platform itself
- A team of 5 engineers can produce a complete, compliance-mapped threat model in under 4 hours (vs. 3 days today)
- A security architect can maintain threat models for 50+ services without dedicating more than 2 hours per sprint
- ThreatForge is deployable in GCP and AWS with managed services, not just a self-hosted VPS

---

## What ThreatForge Is NOT

- **Not a SIEM.** We don't ingest logs or detect active attacks. We model threats proactively.
- **Not a scanner.** We don't run DAST/SAST. We integrate with scanner outputs and map findings to the threat model.
- **Not a GRC platform.** We surface compliance gaps; a GRC tool manages the remediation workflow across the whole organization.
- **Not a whiteboard.** Every component has security semantics (trust level, data classification, methodology). We are purpose-built for threat modeling, not general diagramming.

---

*Vision v1.0 — 2026-05-05. Review quarterly against shipping reality.*
