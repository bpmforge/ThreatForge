# ThreatForge Personas

_Source-of-truth descriptions of the people who use ThreatForge. The use case catalog and test plan both reference these personas by name. Keep this document short — detail belongs in the use cases themselves._

---

## Sam — Security Architect

**Role:** Senior security engineer, works in AppSec or product security team. Maintains 10-50 threat models across the org's products. Formal STRIDE training, 5+ years experience.

**Goals:** Produce defensible threat assessments fast, find real risk before engineers ship, communicate findings to leadership, not waste time on administrative overhead.

**Pain points:** Slow drawing tools, boilerplate generic threats that don't apply, poor traceability from threats back to requirements or controls, can't automate the repetitive parts.

**Frequency:** Daily. Power user. Uses keyboard shortcuts, wants bulk operations.

**Primary flows:** Greenfield build, AI threat suggestion, multi-methodology analysis, exports.

---

## Erin — Engineering Manager

**Role:** Lead or director over 3-15 engineers shipping product features. Owns multiple threat models at a project level without authoring them personally. Reviews and approves.

**Goals:** Know which services in her portfolio have unresolved critical threats, approve or reject AI-suggested threats quickly, assign mitigations to team members, report risk state to VP.

**Pain points:** Dashboards that don't answer her question ("how exposed are we this quarter?"), no bulk operations, no easy way to compare last sprint's risk posture to this sprint's.

**Frequency:** Weekly — during sprint planning, risk review, and audit prep.

**Primary flows:** Portfolio dashboard, review queue, bulk accept/reject, assigning mitigations, model comparison.

---

## Carla — Compliance Officer

**Role:** GRC / compliance lead. Cares about SOC 2, NIST 800-53, HIPAA, PCI-DSS, ISO 27001. Needs traceable evidence for auditors. Often working to a deadline.

**Goals:** Map threats and mitigations to compliance framework controls, run gap analysis, produce auditor-ready reports, maintain requirement traceability to SRS/SAD documents.

**Pain points:** Disconnect between security tools and compliance frameworks, manual spreadsheet reconciliation, evidence scattered across Jira, Confluence, SharePoint.

**Frequency:** Monthly cycles, with deadline bursts before audits.

**Primary flows:** Framework import, gap analysis, coverage dashboard, evidence attachment, compliance exports.

---

## Dev — Developer

**Role:** Junior to senior engineer shipping feature code. Not a security specialist but wants to do the right thing. Might contribute to existing threat models or run a scan against their own repo.

**Goals:** Find the threats that apply to the code they just wrote, get specific mitigation guidance (not "implement strong authentication"), integrate with their existing workflow (Jira, GitHub Actions).

**Pain points:** Security docs that don't reference their specific stack, vague recommendations, context switching from IDE to security tool.

**Frequency:** Sporadic — PR-driven or incident-driven.

**Primary flows:** Code scan (file upload and GitHub URL), document import, AI threat suggestion, Jira push, attack tree generation.

---

## Vera — VP of R&D / CISO

**Role:** Executive stakeholder. Signs off on risk programs. Doesn't create threat models but consumes the outputs.

**Goals:** Understand organizational risk posture at a glance, get executive-grade reports for board meetings, see trends (are we getting better?), know which programs are at risk.

**Pain points:** Tools that require her to do the work, reports in the wrong format, surprise risks she should have known about.

**Frequency:** Weekly overview + ad-hoc before board / audit.

**Primary flows:** Portfolio dashboard, risk analytics, attack paths, compliance overview, executive summary exports, read-only model exploration.

---

## Adam — Admin

**Role:** IT admin or security engineer with ops duties. Configures the platform, manages users, sets guardrails.

**Goals:** Provision users, rotate credentials, configure AI providers, set budgets, manage SSO, audit access.

**Pain points:** Missing CLI tooling, buried admin screens, no audit trail of admin actions.

**Frequency:** Infrequent but critical (setup, onboarding, security incidents).

**Primary flows:** User management, organization settings, AI provider config, SSO/SCIM, audit log, prompt library management, API tokens, webhook config.

---

## Ron — External Reviewer / Auditor

**Role:** Outside consultant, auditor, or business partner. Needs read-only visibility to specific models for a limited time.

**Goals:** Review a specific threat model, understand what was mitigated, see supporting evidence, potentially comment.

**Pain points:** Full accounts they don't need, friction getting access, no expiration.

**Frequency:** One-time or short burst during an audit window.

**Primary flows:** Guest access via share link, read-only model view, commenting.
