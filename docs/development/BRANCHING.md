# Branching Strategy — ThreatForge

**Version:** 1.0  
**Last Updated:** 2026-05-05  
**Enforced in:** `CLAUDE.md` (AI sessions) + this document (human developers)

---

## The Rule in One Line

**Feature design doc on `main` first → feature code on a `feat/` branch → merge when done → delete the branch.**

---

## Branch Taxonomy

| Branch pattern | Purpose | Who creates it | Lifetime |
|---------------|---------|---------------|----------|
| `main` | Production-ready code and shipped-state docs | — | Permanent |
| `feat/<name>` | New user-facing features | Dev starting the feature | Until merged |
| `fix/<name>` | Bug fixes (non-trivial) | Dev fixing the bug | Until merged |
| `docs/<name>` | Documentation-only updates | Anyone | Until merged |
| `chore/<name>` | Dependency updates, CI config, tooling | Anyone | Until merged |

### Naming examples

```
feat/encryption-at-rest
feat/scim-provisioning
feat/github-actions-integration
feat/questionnaire-wizard
fix/canvas-node-lock-regression
fix/cvss-vector-string-export
docs/update-api-reference
chore/bump-prisma-7-1
```

---

## What Lives on `main` Directly

**These commit types go straight to `main` without a branch:**

- Architecture doc updates that reflect already-shipped code
- CLAUDE.md updates
- Dependency bumps with no API changes
- Hotfixes (critical prod bugs — branch preferred but not required if trivial)
- Config and environment file updates

**These require a branch, even if small:**

- Any new frontend component or hook
- Any new backend route or service method
- Any Prisma schema change
- Any new npm package addition
- Any new E2E test spec

---

## The Feature Flow

```
1. Design doc exists on main
        │
        ▼
2. git checkout -b feat/<name>
        │
        ▼
3. Write code + tests + doc updates
   (commit early and often on the branch)
        │
        ▼
4. Push: git push origin feat/<name> && git push github feat/<name>
        │
        ▼
5. Self-review: run tests, check lint
        │
        ▼
6. Merge to main (fast-forward preferred):
   git checkout main
   git merge --no-ff feat/<name>
   git push origin main && git push github main
        │
        ▼
7. Delete branch immediately:
   git push origin --delete feat/<name>
   git push github --delete feat/<name>
   git branch -d feat/<name>
```

---

## Design Doc Gate

Every `feat/` branch must have a corresponding design doc in `docs/plans/` **before any code is written**.

| Feature | Design doc |
|---------|-----------|
| Encryption at rest | `docs/plans/ENCRYPTION_AT_REST.md` ✅ |
| SCIM provisioning | `docs/plans/SCIM_PROVISIONING.md` ✅ |
| DOCX reports | `docs/plans/CUSTOMIZABLE_REPORTS.md` ✅ |
| Agentic AI | `docs/plans/AGENTIC_AI.md` ✅ |
| Business-context risk | `docs/plans/BUSINESS_CONTEXT_RISK.md` ✅ |
| Developer Platform | `docs/plans/DEVELOPER_PLATFORM.md` ✅ |
| AI Pipeline Overhaul | `docs/plans/AI_PIPELINE_OVERHAUL.md` + `WAVE_*.md` ✅ |

If a design doc doesn't exist yet: commit it to `main` first (a `docs/*` commit), then create the feature branch.

**Why:** The design doc is the contract. Anyone picking up the branch knows exactly what to build. Merge reviews check code against the doc, not against vague requirements.

---

## What Goes on `main` vs Feature Branches

```
main/
├── docs/
│   ├── VISION.md                    ← org strategy — main
│   ├── PRODUCT_ROADMAP_2026-H2.md   ← org strategy — main
│   ├── GAPS_AND_IMPROVEMENTS_MASTER.md  ← tracking — main
│   ├── plans/
│   │   ├── ENCRYPTION_AT_REST.md    ← design doc for unstarted feature — main
│   │   └── ...                      ← all design docs live on main until feature branch opens
│   ├── architecture/                ← reflects shipped code — main
│   ├── sdlc/                        ← developer reference — main
│   └── user-stories/                ← product requirements — main
│
feat/encryption-at-rest/
├── server/src/services/encryption/  ← implementation
├── server/prisma/schema/...         ← schema change
├── frontend/src/features/...        ← UI
└── (docs/plans/ENCRYPTION_AT_REST.md stays on main — the spec doesn't move)
```

---

## Active Branches (May 2026)

| Branch | What's in it | Status |
|--------|-------------|--------|
| `feat/ai-suggested-requirements` | AI-proposed requirements review UI (3 commits) | Open — needs merge or continuation |
| `feat/mitigation-requirement-linking` | AI mitigations linked to requirements via citation tags | Open — needs merge or continuation |

---

## Stale Branch Policy

A branch is **stale** if:
- Its PR/merge has been on `main` for > 7 days, OR
- The branch has had no commits for > 30 days without a known reason

**Cleanup rule:** At the start of each session, run:

```bash
git fetch origin --prune
git fetch github --prune
git branch -r --merged main | grep -v "HEAD\|main"
```

Any branch that appears in `--merged main` should be deleted immediately.

---

## Branch Protection (Remotes)

Branch protection is set on `main` on the canonical remote and on GitHub:
- **No force push** to main
- **No branch deletion** of main
- Direct pushes are allowed (small team; PRs not required for every commit)

To update protection settings:
```bash
gh api repos/bpmforge/ThreatForge/branches/main/protection
```

---

## Commit Message Format

```
<type>(<scope>): <short description>

<body — optional, explains WHY not WHAT>
```

**Types:** `feat` · `fix` · `docs` · `chore` · `refactor` · `test` · `perf`  
**Scope:** the feature or area changed (e.g., `canvas`, `ai`, `compliance`, `auth`)

**Examples:**
```
feat(encryption): add AES-256-GCM field-level encryption service
fix(canvas): stable empty-object fallback in useQuickAdd selector
docs(user-stories): add CIA/CVSS stories and update coverage
chore(deps): bump @xyflow/react to 12.4.1
```

---

## Quick Reference

```bash
# Start a new feature
git checkout main && git pull origin main
git checkout -b feat/my-feature

# Push feature branch
git push -u origin feat/my-feature
git push -u github feat/my-feature

# Merge and clean up
git checkout main
git merge --no-ff feat/my-feature
git push origin main && git push github main
git push origin --delete feat/my-feature
git push github --delete feat/my-feature
git branch -d feat/my-feature

# Check for stale branches
git branch -r --merged main | grep -v "HEAD\|main"
```
