# Features Guide

This document provides detailed documentation of all features and modules in ThreatForge.

## Table of Contents

1. [Threat Modeling](#threat-modeling)
2. [Dashboard](#dashboard)
3. [Projects](#projects)
4. [Organizations](#organizations)
5. [AI Features](#ai-features)
6. [Prompt Library](#prompt-library)
7. [Collaboration](#collaboration)
8. [Export](#export)
9. [Version History](#version-history)
10. [Sequence Diagrams](#sequence-diagrams)
11. [Data Flow Diagrams](#data-flow-diagrams)
12. [Threat Library](#threat-library)
13. [Settings](#settings)
14. [Security Features](#security-features)
15. [Customization](#customization)
16. [Integrations](#integrations)
17. [Admin Console](#admin-console)
18. [Document Import](#document-import)
19. [Junior Success](#junior-success)
20. [Expert Productivity](#expert-productivity)
21. [Proactive AI](#proactive-ai)
22. [UX Modernization](#ux-modernization)
23. [API Routes](#api-routes)

---

## Threat Modeling

The core feature for creating and managing security threats.

### Threat Panel

**Location:** Right sidebar in the canvas editor

**Components:**
- `ThreatPanel` - Main threat list with filtering and grouping
- `ThreatCard` - Individual threat display with status, severity, mitigations
- `ThreatPanelHeader` - Header with add button and filter controls

**Features:**
- Filter by STRIDE category, severity, status
- Group threats by category, severity, or component
- Bulk operations for multiple threats
- Risk score badges showing calculated risk levels

### Threat Management

**Adding Threats:**
- `AddThreatDialog` - Create new threats
- Link to specific components or connections
- Select multiple STRIDE categories
- Set initial severity and status
- Add CWE/OWASP references

**Editing Threats:**
- `EditThreatDialog` - Modify existing threats
- Update all threat properties
- Change linked component/connection

**Threat Properties:**
| Property | Description |
|----------|-------------|
| Name | Short descriptive name |
| Description | Detailed explanation |
| STRIDE Categories | One or more STRIDE types |
| Severity | Critical, High, Medium, Low, Info |
| Status | Open, Mitigated, Accepted, Not Applicable |
| Category | Custom organization category |
| CWE IDs | Common Weakness Enumeration references (array) |
| OWASP IDs | OWASP Top 10 references (array, e.g., A07:2021) |
| Source | MANUAL, AI_SUGGESTED, AI_ACCEPTED, AI_MODIFIED |
| Review Status | PENDING, ACCEPTED, REJECTED, MODIFIED |
| CVSS 3.1 Vector/Score | Auto-scored or manual CVSS 3.1 |
| CVSS 4.0 Vector/Score | Auto-scored or manual CVSS 4.0 |
| AI Confidence | 0.0-1.0 confidence from micro-analysis |
| AI Methodology | stride, pasta, kill_chain, mitre_attack, compound |
| Attack Vector | Step-by-step attack scenario |
| Residual Risk | What risk remains after mitigations |

### Mitigation Management

**Components:**
- `MitigationList` - List of mitigations for a threat
- `AddMitigationDialog` - Create new mitigations
- `EditMitigationDialog` - Modify mitigations

**Mitigation Properties:**
| Property | Description |
|----------|-------------|
| Description | High-level control statement (not implementation-specific) |
| Strategy | Prevention, Detection, Response, Recovery, Deterrence |
| Status | NOT_IMPLEMENTED, IMPLEMENTED |
| Verified | Boolean — independently confirmed implementation |
| Obligation | REQUIRED, RECOMMENDED |
| Priority | Critical, High, Medium, Low |
| Control Category | IAM, ENCRYPTION, ACCESS_CONTROL, NETWORK, LOGGING, INPUT_VALIDATION, SECRETS, BACKUP, MONITORING, SUPPLY_CHAIN |
| Test Criteria | How to verify: "Confirm that [testable condition]" |
| Test Result | PASS, FAIL, PARTIAL, UNTESTED |
| Effectiveness Score | 0.0-0.85 — capped, never 100% |
| Implementation Notes | What was actually done (human fills in) |
| Evidence Links | Array of {type, url, title} — ticket, document, screenshot, test_report, scan_result, manual |
| Requirement Refs | Array of {docId, reqId, text} — links to SRS/SAD requirements |
| Assignee | Team member responsible |
| Due Date | Target completion date |
| Notes | Additional information |

### Risk Scoring

**Location:** `features/threats/components/risk-scoring/`

**Supported Frameworks:**
1. **CVSS 3.1** - Attack Vector, Complexity, Privileges, User Interaction, Scope, CIA Impact
2. **CVSS 4.0** - Enhanced metrics with Attack Requirements, Provider Urgency
3. **DREAD** - Damage, Reproducibility, Exploitability, Affected Users, Discoverability
4. **OWASP Risk Rating** - Threat Agent, Vulnerability, Technical/Business Impact
5. **CIA Triad** - Confidentiality, Integrity, Availability impact levels

**Components:**
- `RiskScorePanel` - Framework selector and score entry
- `RiskScoreBadge` - Visual score display
- `CVSS31Panel`, `CVSS40Panel`, `DREADPanel`, `OWASPRiskPanel`, `CIATriadPanel`

---

## Dashboard

**Location:** `/dashboard` route, `features/dashboard/`

The landing page after login showing overview statistics and recent activity.

### Components

| Component | Description |
|-----------|-------------|
| `StatsCard` | Metric display cards |
| `ModelCard` | Threat model preview card |
| `RecentModels` | Grid of recent threat models |
| `QuickActions` | Create new model, import buttons |
| `ActivityFeed` | Recent activity timeline |
| `STRIDEBreakdown` | Chart of threats by STRIDE category |
| `FocusedModelStats` | Detailed stats for selected model |
| `CreateModelDialog` | New threat model creation |
| `MoveToProjectDialog` | Move model between projects |

### Dashboard Stats

- Total threat models
- Open threats count
- Threats by severity breakdown
- Threats by STRIDE category
- Recent activity

### Hooks

```typescript
useThreatModels()      // List all models
useThreatModel(id)     // Get single model
useCreateThreatModel() // Create new model
useDeleteThreatModel() // Delete model
useDuplicateThreatModel() // Clone model
useImportThreatModel() // Import from JSON
useDashboardStats()    // Get statistics
useRecentActivity()    // Get activity feed
```

---

## Projects

**Location:** `/projects` route, `features/projects/`

Organize threat models into projects with team access.

### Components

| Component | Description |
|-----------|-------------|
| `ProjectList` | Grid/list of projects |
| `ProjectCard` | Project preview with stats |
| `ProjectSettings` | Project configuration |
| `CreateProjectDialog` | New project creation |

### Project Properties

| Property | Description |
|----------|-------------|
| Name | Project name |
| Description | Project description |
| Status | Active, Archived |
| Organization | Parent organization |
| Members | Project-specific access |

### Project Roles

| Role | Permissions |
|------|-------------|
| Owner | Full access, can delete |
| Editor | Create/edit models |
| Viewer | Read-only access |

### Hooks

```typescript
useProjects()           // List projects
useProject(id)          // Get single project
useCreateProject()      // Create project
useUpdateProject()      // Update project
useDeleteProject()      // Delete project
useInviteProjectMember() // Add member
useUpdateProjectMemberRole() // Change role
useRemoveProjectMember() // Remove member
```

---

## Organizations

**Location:** `/organization` route, `features/organizations/`

Multi-tenant organization management.

### Components

| Component | Description |
|-----------|-------------|
| `OrganizationPanel` | Main org management view |
| `MembersList` | Organization members table |
| `OrganizationSettings` | Org configuration |
| `InviteMemberDialog` | Send invitations |
| `OrgSwitcher` | Switch between organizations |
| `AuditLogViewer` | View audit trail |
| `UsageQuotas` | View resource usage |
| `WebhookManager` | Configure webhooks |
| `SSOSettings` | SSO configuration |
| `CustomRolesManager` | Create custom roles |
| `LogoUpload` | Organization branding |

### Organization Types

| Type | Description |
|------|-------------|
| Personal | Auto-created user workspace |
| Team | Standard team organization |
| Enterprise | Advanced features enabled |

### Member Roles

| Role | Permissions |
|------|-------------|
| Owner | Full control, can transfer ownership |
| Admin | Manage members, settings, projects |
| Editor | Create/edit projects and models |
| Viewer | Read-only access |

### Hooks

```typescript
useOrganizations()       // List user's orgs
useOrganization(id)      // Get org details
useUpdateOrganization()  // Update settings
useInviteMember()        // Send invitation
useUpdateMemberRole()    // Change member role
useRemoveMember()        // Remove member
useAuditLog()            // Get audit entries
useCurrentUserRole()     // Get current user's role
useOrgPermissions()      // Check permissions
```

---

## Custom Roles

**Location:** `features/organizations/`, `server/src/api/custom-roles.ts`, `server/src/services/access-control/`

Fine-grained permission system beyond default roles.

### Components

| Component | Description |
|-----------|-------------|
| `CustomRolesManager` | Create and manage custom roles |
| `RolePermissionsEditor` | Configure role permissions — *not shipped: exists but is never rendered* |
### Default Roles

| Role | Built-in Permissions |
|------|---------------------|
| Owner | All permissions, can transfer ownership |
| Admin | Member management, settings, all content |
| Editor | Create/edit models, threats, mitigations |
| Viewer | Read-only access to all content |

### Custom Role Permissions

Custom roles can include any combination of:

| Permission | Description |
|------------|-------------|
| `models:read` | View threat models |
| `models:create` | Create new models |
| `models:update` | Edit existing models |
| `models:delete` | Delete models |
| `threats:read` | View threats |
| `threats:create` | Add threats |
| `threats:update` | Edit threats |
| `threats:delete` | Delete threats |
| `members:read` | View organization members |
| `members:invite` | Invite new members |
| `members:manage` | Update roles, remove members |
| `settings:read` | View organization settings |
| `settings:update` | Modify organization settings |
| `projects:read` | View projects |
| `projects:create` | Create projects |
| `projects:update` | Edit projects |
| `projects:delete` | Delete projects |

### API Endpoints

Endpoints: see [API Routes](#api-routes), group `/api/organizations`.

### Access Control Service

**Backend:** `server/src/services/access-control/access-control-service.ts`

Enforces custom role permissions:
```typescript
// Check single permission
hasCustomPermission(userId, orgId, permission)

// Check all permissions
hasAllPermissions(userId, orgId, permissions[])

// Check any permission
hasAnyPermission(userId, orgId, permissions[])

// Extended org access check
checkOrganizationAccessExtended(userId, orgId)
```

---

## Webhooks

**Location:** `features/organizations/`, `server/src/api/webhooks.ts`, `server/src/services/webhooks/`

Event notifications to external systems.

### Components

| Component | Description |
|-----------|-------------|
| `WebhookManager` | List and manage webhooks |

### Supported Events

| Event | Trigger |
|-------|---------|
| `threat.created` | New threat added |
| `threat.updated` | Threat modified |
| `threat.deleted` | Threat removed |
| `mitigation.created` | New mitigation added |
| `mitigation.updated` | Mitigation modified |
| `mitigation.completed` | Mitigation status changed to completed |
| `member.added` | New member joined organization |
| `member.removed` | Member removed from organization |
| `member.role_changed` | Member role updated |
| `invitation.sent` | Invitation email sent |
| `invitation.accepted` | Invitation accepted |

### Webhook Configuration

| Property | Description |
|----------|-------------|
| URL | HTTPS endpoint to receive events |
| Secret | Shared secret for HMAC signature |
| Events | Which events to subscribe to |
| Active | Enable/disable webhook |

### Webhook Payload

```json
{
  "event": "threat.created",
  "timestamp": "2025-12-30T12:00:00Z",
  "organization": {
    "id": "org_123",
    "name": "Acme Corp"
  },
  "data": {
    // Event-specific payload
  }
}
```

### Security

- HMAC-SHA256 signature in `X-Signature-256` header
- Verify signature: `HMAC(payload, secret)`
- Retry on failure (3 attempts with exponential backoff)

### API Endpoints

Endpoints: see [API Routes](#api-routes), group `/api/organizations`.

### Webhook Dispatcher Service

**Backend:** `server/src/services/webhooks/webhook-dispatcher.ts`

```typescript
// Dispatch event to all subscribed webhooks
dispatchWebhookEvent(orgId, event, payload)

// Integrated in:
// - threats.ts (threat CRUD)
// - mitigations.ts (mitigation CRUD)
// - members.ts (membership changes)
// - invitations.ts (invitation events)
```

---

## SSO (Single Sign-On)

**Location:** `features/organizations/`, `server/src/api/sso.ts`

Enterprise SSO via SAML and OIDC.

### Components

| Component | Description |
|-----------|-------------|
| `SSOSettings` | Configure SSO for organization |

### Supported Providers

| Type | Providers |
|------|-----------|
| SAML 2.0 | Okta, Azure AD, OneLogin, custom |
| OIDC | Google Workspace, Azure AD, Keycloak |

### SAML Configuration

Uses BoxyHQ Jackson for SAML processing:
- Metadata URL or XML upload
- Attribute mapping
- Just-in-time provisioning
- SP-initiated and IdP-initiated flows

### Admin Settings

```typescript
// In SystemSettings
samlEnabled: boolean;
samlJacksonUrl: string;    // BoxyHQ Jackson URL
samlProductId: string;     // Product identifier
```

### API Endpoints

Endpoints: see [API Routes](#api-routes), group `/api/organizations`.

---

## AI Features

**Location:** `features/ai/`

AI-powered threat analysis and suggestions.

### Components

| Component | Description |
|-----------|-------------|
| `AIThreatSuggestions` | Suggested threats panel |
| `AIChatPanel` | Interactive AI assistant — *not shipped: exists but is never rendered* |
### AI Threat Suggestions

- Analyzes architecture diagram
- Suggests relevant threats based on components
- Recommends mitigations
- Multi-provider support

### AI Chat

- Ask questions about security
- Get explanations of threats
- Request mitigation advice
- Context-aware (knows your model)

### Supported Providers

| Provider | Type |
|----------|------|
| Anthropic | Claude models |
| OpenAI | GPT models |
| Google | Gemini models |
| Azure OpenAI | Enterprise OpenAI |
| Ollama | Self-hosted LLMs |

### Hooks

```typescript
useAISuggestions()  // Get threat suggestions
useAIChat()         // Chat interface
```

---

## Prompt Library

**Location:** `features/prompt-library/`

Configurable AI prompts and multi-stage pipelines for document analysis.

### Components

| Component | Description |
|-----------|-------------|
| `PromptLibrary` | Browse and manage prompt templates |
| `PromptEditor` | Create/edit prompt templates |
| `DocumentTypeManager` | Configure document type detection |
| `DocumentTypeEditor` | Create/edit document types — *not shipped: exists but is never rendered* |
| `ExecutionLogsViewer` | View execution history and stats |
| `PipelineList` | Browse and manage pipelines — *not shipped: exists but is never rendered* |
| `PipelineBuilder` | Create/edit multi-stage pipelines — *not shipped: exists but is never rendered* |
| `PipelineExecutionViewer` | Monitor pipeline execution — *not shipped: exists but is never rendered* |
### Prompt Templates

Configurable AI prompts with:
- **Categories:** Classification, Extraction, Analysis, Threat Identification, etc.
- **Variables:** Template variables like `{{document}}`, `{{components}}`
- **Output formats:** JSON, Text, Markdown
- **Vision support:** Process images and diagrams
- **Clone-only built-ins:** Clone and customize built-in prompts

### Document Types

Automatic document detection:
- **Detection rules:** Keywords, patterns, file extensions
- **Priority ordering:** Most specific match wins
- **Auto-prompt selection:** Link document types to prompts

### Pipelines

Multi-stage document processing:
- **Sequential execution:** Stages run in order
- **Variable mapping:** Pass outputs between stages
- **Conditional execution:** Skip stages based on conditions
- **Retry logic:** Automatic retry on failure
- **Real-time tracking:** Monitor execution progress

### Execution Logs

Track AI usage:
- **Statistics dashboard:** Success rate, tokens used, duration
- **Detailed logs:** Full input/output for each execution
- **Filter and search:** Find specific executions

### Hooks

```typescript
usePrompts()           // List prompt templates
useCreatePrompt()      // Create new prompt
useClonePrompt()       // Clone a prompt
useUpdatePrompt()      // Update prompt
useDeletePrompt()      // Delete prompt
useDocumentTypes()     // List document types
usePipelines()         // List pipelines
usePipeline()          // Get pipeline details
useExecutePipeline()   // Execute a pipeline
usePipelineExecution() // Get execution details
useExecutionLogs()     // Execution history
useExecutionStats()    // Usage statistics
```

### Access

**Settings > AI Prompts** contains:
- Prompt Library tab
- Pipelines tab
- Document Types tab
- Execution Logs tab

---

## Collaboration

**Location:** `features/collaboration/`

Real-time multi-user editing.

### Components

| Component | Description |
|-----------|-------------|
| `CollaboratorCursors` | Show other users' cursors |
| `ConnectionStatusIndicator` | WebSocket connection status — *not shipped: exists but is never rendered* |
| `SelectionHighlights` | Show what others have selected |

### Features

- **Real-time sync** - Changes appear instantly for all users
- **Presence awareness** - See who else is viewing/editing
- **Cursor tracking** - See where teammates are working
- **Conflict-free** - Yjs CRDT handles concurrent edits

### Hooks

```typescript
useCollaboration()       // Main collaboration hook
useCollaborativeCanvas() // Canvas-specific sync
useYArray()              // Yjs array helpers
useYMap()                // Yjs map helpers
```

---

## Export

**Location:** `features/export/`

Export threat models in multiple formats.

### Export Formats

| Format | Description |
|--------|-------------|
| PDF | Professional report with threats, mitigations |
| JSON | Machine-readable, can be re-imported |
| YAML | Human-readable structured format |
| PNG | Raster image of canvas |
| SVG | Vector image of canvas |
| Mermaid | Architecture, sequence, and DFD diagrams as Mermaid syntax |
| Draw.io | XML format compatible with Draw.io/diagrams.net |

### Export Functions

```typescript
exportToPDF(model)              // Generate PDF report
exportToJSON(model)             // Export as JSON
exportToYAML(model)             // Export as YAML
exportToPNG(canvas)             // Canvas screenshot
exportToSVG(canvas)             // Vector export
exportToMermaid(nodes, edges)   // Architecture as Mermaid flowchart
exportToDrawio(nodes, edges)    // Architecture as Draw.io XML
exportSequenceToMermaid(diagram) // Sequence diagram as Mermaid
exportDFDToMermaid(nodes, edges) // DFD as Mermaid flowchart
```

### PDF Report Contents

- Model metadata (name, version, status)
- Canvas diagram image
- Threat summary table
- Detailed threat descriptions
- Mitigation status
- STRIDE breakdown chart
- Compliance mappings

---

## Version History

**Location:** `features/version-history/`

Create and restore threat model versions.

### Components

| Component | Description |
|-----------|-------------|
| `VersionHistoryPanel` | List of versions |
| `CreateVersionDialog` | Create snapshot |
| `EditVersionDialog` | Edit version metadata |
| `VersionCompareDialog` | Compare versions |

### Version Properties

| Property | Description |
|----------|-------------|
| Version Number | Auto-incremented |
| Canvas State | Full snapshot of diagram |
| Changes Summary | Description of what changed |
| Created By | User who created version |
| Created At | Timestamp |

### Hooks

```typescript
useVersionHistory()  // List versions
useVersion(id)       // Get version details
useCreateVersion()   // Create snapshot
useRestoreVersion()  // Restore from version
useUpdateVersion()   // Update metadata
```

---

## Sequence Diagrams

**Location:** `features/sequence-diagrams/`

Create sequence diagrams linked to architecture.

### Components

| Component | Description |
|-----------|-------------|
| `DiagramTabs` | Tab bar for switching diagrams |
| `SequenceCanvas` | Sequence diagram editor |
| `SequenceParticipant` | Participant (actor) component |
| `SequenceMessage` | Message arrow between participants |
| `ParticipantPicker` | Select from architecture components |
| `AddMessageDialog` | Create new message |

### Message Types

| Type | Description |
|------|-------------|
| Sync | Synchronous call (solid arrow) |
| Async | Asynchronous call (open arrow) |
| Return | Return message (dashed line) |
| Self | Self-call (loop back) |
| Create | Object creation |
| Destroy | Object destruction |

### Message Properties

- Label (description)
- Protocol (HTTP, gRPC, etc.)
- Authentication method
- Associated threats

### Hooks

```typescript
useSequenceDiagrams()       // List diagrams
useCreateSequenceDiagram()  // Create diagram
useUpdateSequenceDiagram()  // Update diagram
useDeleteSequenceDiagram()  // Delete diagram
useCreateParticipant()      // Add participant
useCreateMessage()          // Add message
useReorderMessages()        // Reorder vertically
```

---

## Data Flow Diagrams

**Location:** `features/dfd/`

Create DFD diagrams (Level 0 and Level 1).

### Components

| Component | Description |
|-----------|-------------|
| `DFDCanvas` | DFD diagram editor |
| `DFDPalette` | DFD element palette |
| `DFDProcessNode` | Process circle |
| `DFDDataStoreNode` | Data store (parallel lines) |
| `DFDExternalEntityNode` | External entity (rectangle) |
| `DFDFlowEdge` | Data flow arrow |
| `DFDListPanel` | List of DFDs — *not shipped: exists but is never rendered* |
| `DFDPropertiesPanel` | Edit DFD element properties — *not shipped: exists but is never rendered* |
### DFD Elements

| Element | Symbol | Description |
|---------|--------|-------------|
| Process | Circle | Transforms data |
| Data Store | Parallel lines | Stores data |
| External Entity | Rectangle | External system/user |
| Data Flow | Arrow | Data movement |

### Auto-Numbering

- Processes: 1.0, 2.0, 3.0...
- Data Stores: D1, D2, D3...

---

## Threat Library

**Location:** `features/threat-library/`

Pre-defined STRIDE threats and templates.

### Components

| Component | Description |
|-----------|-------------|
| `ThreatLibraryBrowser` | Browse threat templates |
| `ThreatLibraryDialog` | Select threats to add |
| `ThreatLibraryItem` | Single threat template |
| `ThreatLibraryFilters` | Filter by category |
| `LibraryManagerDialog` | Manage custom libraries |

### Built-in Threats

Organized by STRIDE category with:
- Standard threat descriptions
- Default severity
- Suggested mitigations
- Applicable component types
- CWE/OWASP mappings

### Custom Libraries

- Organization-specific threat templates
- Import/export libraries
- Share between organizations

### Hooks

```typescript
useThreatLibrary()        // Get static library
useThreatLibraries()      // List custom libraries
useCreateThreatLibrary()  // Create library
useThreatTemplates()      // Get templates
useCreateThreatTemplate() // Create template
useImportThreatLibrary()  // Import from file
useExportThreatLibrary()  // Export to file
```

---

## Settings

**Location:** `/settings` route, `features/settings/`

User preferences and AI configuration.

### Components

| Component | Description |
|-----------|-------------|
| `AISettingsPanel` | AI provider configuration |
| `AIProviderSelect` | Choose AI provider |
| `AIApiKeyInput` | Secure API key entry |
| `AIFeatureToggles` | Enable/disable AI features |
| `AIGuardrails` | AI usage limits |
| `AIProvidersSettings` | Multi-provider management |
| `AIUsageSummary` | Token/cost tracking |

### AI Settings

| Setting | Description |
|---------|-------------|
| Provider | Anthropic, OpenAI, Google, Ollama |
| API Key | Provider API key (encrypted) |
| Model | Specific model to use |
| Base URL | Custom endpoint (Ollama) |
| Features | Suggestions, chat toggles |

### Hooks

```typescript
useAISettings()         // Get current settings
useAIProviders()        // List configured providers
useCreateAIProvider()   // Add provider
useUpdateAIProvider()   // Update provider
useDeleteAIProvider()   // Remove provider
useTestAIProvider()     // Test connection
useAIProviderUsage()    // Get usage stats
```

---

## Security Features

**Location:** `features/security/`, `server/src/api/two-factor.ts`, `server/src/api/sessions.ts`, `server/src/api/api-tokens.ts`

Comprehensive account and system security controls.

### Components

| Component | Description |
|-----------|-------------|
| `TwoFactorSetup` | Enable/configure TOTP 2FA |
| `SessionManager` | View/revoke sessions |
| `ApiTokenManager` | Personal access tokens |
| `DataPrivacy` | Data export/deletion |

### Two-Factor Authentication (2FA/MFA)

**Backend:** `server/src/api/two-factor.ts`, `server/src/services/two-factor.ts`

- TOTP-based (Google Authenticator, Authy compatible)
- Backup codes for recovery (hashed, one-time use)
- Enable/disable/verify workflow
- QR code generation for setup
- **MFA Enforcement** - Admins can require 2FA for all users

**API Endpoints:** see [API Routes](#api-routes).

### Session Management

**Backend:** `server/src/api/sessions.ts`

- List active sessions with device/browser info
- IP address and approximate location
- Last activity timestamp
- Revoke individual sessions
- Revoke all sessions (except current)
- **Configurable session timeout** - Admin-configurable (default 24h)

**API Endpoints:** see [API Routes](#api-routes).

### API Tokens (Personal Access Tokens)

**Backend:** `server/src/api/api-tokens.ts`

- Create named access tokens for API/CI access
- Scope-based permissions (read:models, write:threats, etc.)
- Optional expiry dates
- Usage tracking (last used timestamp)
- Token prefix for identification (`ftm_...`)
- Secure hashing (only prefix shown after creation)

**API Endpoints:** see [API Routes](#api-routes).

**Token Scopes:**
| Scope | Description |
|-------|-------------|
| `read:models` | Read threat models |
| `write:models` | Create/update threat models |
| `read:threats` | Read threats |
| `write:threats` | Create/update threats |
| `admin` | Full administrative access |

### Password Policy

**Backend:** `server/src/services/password-validation.ts`

Admin-configurable password requirements:
- Minimum length (default: 12)
- Require uppercase letters
- Require lowercase letters
- Require numbers
- Require special characters

Policy cached for 1 minute to reduce database queries.

### Account Lockout

- Configurable max failed login attempts (default: 5)
- Configurable lockout duration (default: 15 minutes)
- Automatic unlock after lockout period
- Account status tracking (ACTIVE, LOCKED, SUSPENDED)

### User Suspension

**Backend:** `server/src/api/users.ts`, `server/src/services/membership/`

- Admin can suspend users
- Suspended users cannot log in
- Suspension reason stored for audit
- Reactivation by admin

---

## Customization

**Location:** `features/customization/`

Organization-specific customizations.

### Components

| Component | Description |
|-----------|-------------|
| `CustomCategoriesPanel` | Manage threat categories |
| `CategoryDialog` | Create/edit category |
| `MitigationLibrariesPanel` | Mitigation templates |
| `MitigationTemplatesPanel` | Template management |
| `TemplateDialog` | Create/edit template |

### Custom Threat Categories

Beyond STRIDE, create organization-specific categories:
- Custom name and description
- Color coding
- Icon selection
- Sort order

### Mitigation Libraries

Reusable mitigation templates:
- Strategy (Prevention, Detection, etc.)
- Effort level
- Effectiveness rating
- Implementation steps
- Prerequisites
- Compliance mappings

### Model Templates

**Location:** `features/model-templates/`

Pre-built threat model starting points:
- Full canvas state
- Pre-populated components
- Common threats included
- Categories (Web App, Microservices, Mobile)

---

## Integrations

**Location:** `features/integrations/`

Third-party system connections.

### Components

| Component | Description |
|-----------|-------------|
| `IntegrationsPanel` | List of integrations |
| `IntegrationCard` | Integration status card |
| `JiraSetupWizard` | JIRA configuration |
| `GitHubSetupWizard` | GitHub configuration |

### Supported Integrations

| Integration | Features | Status |
|-------------|----------|--------|
| JIRA | Create issues from threats | Implemented |
| GitHub | Issue tracking | Implemented |
| Slack | Notifications | Implemented |
| MS Teams | Notifications | Implemented |
| Custom Webhook | Generic events | Implemented |

### Integration Properties

- Connection status
- Sync direction (push/pull/bidirectional)
- Field mappings
- Last sync time
- Error tracking

### Hooks

```typescript
useIntegrations()           // List integrations
useDeleteIntegration()      // Remove integration
useTriggerSync()            // Manual sync
useCreateJiraIntegration()  // Set up JIRA
useCreateJiraIssue()        // Create JIRA issue
```

### Diagram Import

**Location:** `features/integrations/diagram-import/`

Import diagrams from external tools.

**Supported Sources:**

| Source | Format | Description |
|--------|--------|-------------|
| Draw.io | `.xml`, `.drawio` | diagrams.net exports |
| Mermaid | `.md`, `.mmd`, `.mermaid` | Flowchart, sequence, C4 diagrams |
| Lucidchart | `.csv` | CSV export from Lucidchart |

**Import Functions:**

```typescript
parseDrawioXml(content)      // Parse Draw.io XML
parseMermaidDiagram(content) // Parse Mermaid syntax
parseLucidchartCsv(content)  // Parse Lucidchart CSV
convertDiagramToCanvas(parsed) // Convert to architecture canvas
convertDiagramToDFD(parsed)    // Convert to DFD canvas
```

**Components:**
- `DiagramImportDialog` - Import wizard with format selection
- Import target selection (Architecture or DFD canvas)
- Preview before import

---

## Admin Console

**Location:** `/admin` routes, `features/admin/`, `server/src/api/admin.ts`

System-wide administration (super admin only).

### Pages

| Route | Description |
|-------|-------------|
| `/admin` | Dashboard with system stats |
| `/admin/users` | User management with bulk import |
| `/admin/organizations` | Organization management |
| `/admin/audit` | System audit logs with export |
| `/admin/settings` | System configuration (7 tabs) |

### Components

| Component | Description |
|-----------|-------------|
| `AdminSidebar` | Admin navigation |
| `StatsCard` | System metrics |
| `SystemHealthCard` | Service status |
| `UsersTable` | User list with search, last login, bulk import |
| `AuditLogTable` | Audit log viewer with filters |
| `BulkImportDialog` | CSV bulk user import |

### Admin Capabilities

**User Management:**
- View all users with last login timestamps
- Promote/demote system administrators
- Suspend/unsuspend users
- Delete users
- **Bulk import users via CSV** - email, role, organizationId per row

**Organization Management:**
- View all organizations
- View member counts and project counts
- Delete organizations (cascades to all data)

**System Settings (7 tabs):**

| Tab | Settings |
|-----|----------|
| General | Sign-ups, email verification, default role |
| Security | Session timeout, account lockout, password policy, MFA enforcement |
| AI | Enable AI, provider selection |
| SAML SSO | SAML configuration (Jackson URL, product ID) |
| IP Allowlist | Enable/configure allowed IP ranges |
| Email | Email provider, from address, SMTP/SendGrid/Resend config |
| OAuth | Google, GitHub, Microsoft, custom OIDC providers |

**Audit Logs:**
- Filter by entity type, action, user, date range
- Export to CSV or JSON
- Retention policy configuration
- Automatic purge of old logs

### System Settings API

**Backend:** `server/src/api/admin.ts`

Endpoints: see [API Routes](#api-routes), group `/api/admin`.

```typescript
// Settings shape
interface SystemSettings {
  // General
  allowSignups: boolean;
  requireEmailVerification: boolean;
  defaultUserRole: 'VIEWER' | 'EDITOR' | 'ADMIN';

  // Security
  sessionTimeoutHours: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;

  // Password Policy
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;

  // MFA
  mfaRequired: boolean;

  // Resource Limits
  maxProjectsPerOrg: number;

  // AI
  enableAI: boolean;
  aiProvider: string;

  // Audit
  auditRetentionDays: number;

  // SSO
  samlEnabled: boolean;
  samlJacksonUrl: string;
  samlProductId: string;

  // IP Allowlist
  ipAllowlistEnabled: boolean;
  ipAllowlist: string[];

  // Email
  emailProvider: 'none' | 'smtp' | 'sendgrid' | 'resend' | 'ses';
  emailFrom: string;
  emailConfig: object;
}
```

### Bulk User Import

**Backend:** `POST /api/admin/users/bulk-invite`

Import users via CSV format:
```csv
email,role,organizationId
user1@example.com,EDITOR,org_abc123
user2@example.com,VIEWER,org_abc123
```

Returns per-row success/failure with error details.

### Admin Hooks

```typescript
useAdminStats()       // Dashboard statistics
useSystemHealth()     // Service health check
useUsers()            // Paginated user list
useUpdateUser()       // Update user (promote/demote)
useDeleteUser()       // Delete user
useBulkInvite()       // Bulk CSV import
useOrganizations()    // Organization list
useAuditLog()         // Audit log with filters
useSystemSettings()   // Get/update settings
```

### Guards

```typescript
useSystemAdminGuard()  // Require super admin (isSuperAdmin)
```

---

## Toolbar

**Location:** `features/toolbar/`

Canvas toolbar controls.

### Components

| Component | Description |
|-----------|-------------|
| `Toolbar` | Main toolbar component |
| `SaveStatusIndicator` | Auto-save status |
| `LoadDialog` | Open threat model |
| `SaveDialog` | Save as dialog |
| `ExportMenu` | Export format selection |
| `ModelStatusBadge` | Draft/Published indicator |
| `ModelTagsEditor` | Edit model tags |

### Toolbar Actions

- Save (manual)
- Load/Open
- Export (PDF, JSON, YAML, PNG, SVG)
- Undo/Redo
- Version history
- Model status
- Tags management

---

## Auto-Save

**Location:** `features/auto-save/`

Automatic state persistence.

### Features

- **Local backup** - Save to localStorage for crash recovery
- **Remote save** - Debounced save to server
- **Conflict detection** - Warn on concurrent edits
- **Status indicator** - Show save state

### Save States

| Status | Description |
|--------|-------------|
| Saved | All changes persisted |
| Saving | Save in progress |
| Unsaved | Pending changes |
| Error | Save failed |

### Hooks

```typescript
useAutoSave({
  modelId,
  debounceMs: 2000,
  enableLocalBackup: true
})
```

---

## Component Templates

**Location:** `features/component-templates/`

Reusable component configurations.

### Components

| Component | Description |
|-----------|-------------|
| `ComponentTemplateManagerDialog` | Manage templates |
| `ComponentTemplateBrowser` | Browse and select |

### Template Properties

- Component type
- Default properties
- Custom icon and color
- Suggested threats
- Tags for categorization

### Hooks

```typescript
useComponentTemplateLibraries()  // List libraries
useComponentTemplates()          // Get templates
useCreateComponentTemplate()     // Create template
useImportComponentTemplateLibrary() // Import library
```

---

## Marketplace

**Location:** `features/marketplace/`

Browse and share libraries.

### Components

| Component | Description |
|-----------|-------------|
| `MarketplaceBrowser` | Browse public libraries |
| `LibraryCard` | Library preview card |

### Features

- Browse public threat libraries
- Browse mitigation libraries
- Subscribe to libraries
- Auto-update subscriptions
- Usage statistics

### Hooks

```typescript
usePublicLibraries()        // Browse marketplace
useSubscriptions()          // User's subscriptions
useSubscribeToLibrary()     // Subscribe
useUnsubscribeFromLibrary() // Unsubscribe
useMarketplaceStats()       // Popularity stats
```

---

## User Stories

**Location:** `features/user-stories/`

Link user stories to DFDs (Phase 2 feature).

### Components

- `UserStoryList` - List of stories
- `UserStoryEditor` - Create/edit stories

### User Story Format

```
As a [user type]
I want [feature]
So that [benefit]

Acceptance Criteria:
- Criterion 1
- Criterion 2
```

### Integration

- Link stories to DFD data flows
- Track story status
- External ID mapping (JIRA, etc.)

---

## Document Import

**Location:** `features/document-import/`

Import architecture information from documents.

### Components

| Component | Description |
|-----------|-------------|
| `DocumentImportDialog` | Import wizard for documents |
| `LinkedDocumentsPanel` | View linked source documents — *not shipped: exists but is never rendered* |
| `ChangeReviewDialog` | Review changes from document updates — *not shipped: exists but is never rendered* |
### Supported Formats

- PDF documents
- Microsoft Word (DOCX)
- Markdown files
- Plain text

### Features

- AI-powered architecture extraction
- Component and data flow detection
- Link documents to threat models
- Change detection on re-import

---

## Junior Success

**Location:** `features/junior-success/`

Tools and components to help junior engineers create quality threat models.

### Components

| Component | Description |
|-----------|-------------|
| `StrideTutorialDialog` | Interactive STRIDE methodology tutorial |
| `ReadinessIndicator` | Model completeness/readiness indicator |

### Features

- **STRIDE Tutorial** - Interactive walkthrough of each STRIDE category with examples
- **Readiness Checks** - Validates model has minimum required elements
- **Progress Tracking** - Track tutorial completion and learning progress

### Hooks

```typescript
useReadiness()           // Calculate model readiness score
getTutorialForCategory() // Get tutorial content for STRIDE category
calculateReadiness()     // Compute readiness from model state
```

### Data

- `STRIDE_TUTORIAL` - Tutorial content for each category
- `READINESS_CRITERIA` - Checklist criteria for model completeness

---

## Expert Productivity

**Location:** `features/expert-productivity/`

Tools for power users to work efficiently at scale.

### Components

| Component | Description |
|-----------|-------------|
| `BatchOperationsToolbar` | Toolbar for bulk operations on selected items — *not shipped: exists but is never rendered* |
### Features

- **Batch Operations** - Apply changes to multiple components/threats at once
- **Quick Actions** - Keyboard-driven actions for common tasks
- **Selection Stats** - Summary of selected items

### Hooks

```typescript
useBatchOperations()  // Manage batch operation state and execution
```

### Batch Action Types

| Action | Description |
|--------|-------------|
| Delete | Remove multiple items |
| Move | Move to different boundary/group |
| Tag | Apply tags to selection |
| Assign | Assign threats to component |

---

## Proactive AI

**Location:** `features/proactive-ai/`

AI-powered suggestions and contextual help that proactively assists users.

### Components

| Component | Description |
|-----------|-------------|
| `ComponentThreatPopover` | Threat suggestions popover on components — *not shipped: exists but is never rendered* |
| `ThreatBadge` | Visual indicator of threats on canvas — *not shipped: exists but is never rendered* |
| `SeverityCalculator` | Interactive severity scoring wizard |
| `StrideContextualHelp` | Contextual STRIDE help panels |

### Features

- **Auto-Suggestions** - Suggest threats when components are added
- **Severity Calculator** - Guided severity assessment questions
- **STRIDE Help** - Context-aware help for each STRIDE category
- **Common Threats** - Pre-defined threats by component type

### Hooks

```typescript
useAutoSuggestions()       // Get AI suggestions for component
useSeverityCalculation()   // Manage severity calculator state
```

### Data

- `COMMON_THREATS_BY_TYPE` - Pre-defined threats per component type
- `SEVERITY_QUESTIONS` - Questions for severity calculation
- `STRIDE_HELP` - Help content for each STRIDE category

---

## UX Modernization

**Location:** `features/ux-modernization/`

Modern UX patterns, animations, and accessibility improvements.

### Components

| Component | Description |
|-----------|-------------|
| `AnimatedCounter` | Smooth number animations — *not shipped: exists but is never rendered* |
| `FadeIn` | Fade-in animation wrapper — *not shipped: exists but is never rendered* |
| `Skeleton` | Loading skeleton components |
| `SuccessAnimation` | Success state animations — *not shipped: exists but is never rendered* |
### Features

- **Micro-interactions** - Subtle animations for feedback
- **Reduced Motion** - Respects `prefers-reduced-motion`
- **Loading States** - Consistent skeleton loaders
- **Transitions** - Smooth state transitions

### Hooks

```typescript
useReducedMotion()      // Check user's motion preference
useAnimationClasses()   // Get animation CSS classes
```

### Animation Utilities

```typescript
import { DURATION, EASING, animations, transitions } from '@/features/ux-modernization';

// Duration presets
DURATION.fast    // 150ms
DURATION.normal  // 300ms
DURATION.slow    // 500ms

// Easing presets
EASING.default   // ease-out
EASING.bounce    // custom bounce curve

// Animation helpers
staggerDelay(index)  // Calculate stagger delay
staggerStyle(index)  // Get style object with delay
```

---

## Compliance Frameworks

**12 built-in compliance frameworks** with automatic threat-to-control gap analysis:

| Framework | Controls | Use Case |
|-----------|----------|----------|
| SOC 2 Type II | 15 | SaaS audits |
| ISO 27001:2022 | 114 | International security certification |
| NIST CSF 2.0 | 23 | Cybersecurity risk management |
| NIST SP 800-53 | 71 | Federal systems (FedRAMP, ATO) |
| HIPAA Security Rule | 42 | Healthcare (ePHI protection) |
| PCI DSS 4.0 | 50 | Payment card industry |
| FDA Cybersecurity | 31 | Medical devices (510(k), eSTAR) |
| OWASP ASVS 4.0 | 108 | Application security verification |
| CMMC 2.0 | 23 | Defense contractors |
| NIST SP 800-171 | 110 | Controlled unclassified information |
| ISO 27701:2019 | 65 | Privacy information management |
| CCPA/CPRA | 17 | California consumer privacy |

**How it works:**
- Each control has STRIDE category mappings and keyword lists
- Threats and mitigations are automatically matched to controls
- Coverage calculated: NOT_ADDRESSED → PARTIALLY_ADDRESSED → FULLY_ADDRESSED
- Gap reports with recommendations and effort estimates
- Custom frameworks supported (inherit from built-in + add controls)

---

## AI Features (Enhanced)

### Background AI Jobs
All AI operations run as background jobs via BullMQ + Redis:
- User clicks "Suggest Threats" → job queued → user can navigate away
- Job progress tracked via polling (3s intervals)
- Toast notification when results are ready
- Falls back to sync mode if Redis unavailable

### Expert Analysis (6-Pass Pipeline)
Toolbar button triggers comprehensive analysis:
1. **Understand** — Classify architecture and attack surface
2. **Analyze Flows** — Examine every data flow and trust boundary
3. **Identify Threats** — Component-by-component STRIDE analysis
4. **Attack Chains** — Trace lateral movement paths
5. **Verify** — Filter false positives, check quality (loops ×2)
6. **Consolidate** — Deduplicate and prioritize

### Streaming Chat with Architecture Context
- SSE-based real-time streaming responses
- AI has full knowledge of the current threat model's components, connections, and boundaries
- Can answer specific questions about THIS architecture

### Refinement Questions
- "Refine" tab shows completeness score (0-100%)
- Categorized questions (auth, data, network, encryption, integration, deployment)
- Each question includes impact description

### Auto-Suggest on Component Add
- When a new component is added to the canvas, AI automatically suggests threats
- Debounced (500ms) to avoid excessive calls
- Toast notification with suggestion count

### Realistic Mitigation Effectiveness
- No single mitigation exceeds 85% effectiveness
- Non-round numbers (0.47, 0.63 — not 0.50, 0.80)
- Diminishing returns formula for cumulative risk reduction
- Residual risk always exists (capped at 95% max effectiveness)
- Per-mitigation effectiveness bars in UI
- Residual risk summary with color coding

---

## Trust Boundaries

Visual trust zone grouping with automatic threat escalation:

### Trust Levels
| Level | Color | Description |
|-------|-------|-------------|
| PUBLIC | Green | Internet-facing, untrusted traffic |
| INTERNAL | Blue | Backend services, authenticated access |
| CONFIDENTIAL | Amber | Sensitive data handling |
| RESTRICTED | Red | Critical data stores, strict access control |

### Features
- Dashed-line colored rectangles grouping components
- Drag components into/out of boundaries
- Create from right-click menu, palette, or Ctrl+G on selection
- Nesting supported (boundaries inside boundaries)
- Data flows crossing boundaries turn **orange** and generate HIGH severity STRIDE threats
- AI infers trust boundaries from document extraction

---

## Edge Routing

A* grid-based orthogonal router (same approach as draw.io/Visio):
- Lines always exit RIGHT from source, enter LEFT on target
- Never pass through any component (12px clearance)
- Complex multi-jog paths (H/V/H/V/H...)
- Sparse grid from obstacle boundaries + global highway channels
- Turn penalty for cleaner paths
- Line jumps (semicircle arcs) at crossing points

---

## Public API

Token-authenticated REST API for CISO integrations and GRC tools.

### Authentication
- API tokens with `ftm_` prefix
- 9 scopes: `read:models`, `write:models`, `read:threats`, `write:threats`, `read:projects`, `write:projects`, `read:organizations`, `ci:read`, `ci:write`
- Configurable expiry (up to 90 days)
- Usage tracking and revocation

### Key Endpoints
See [API Routes](#api-routes), groups `/api/v1/*`. Swagger documentation is served at `/docs` outside production.

### Outbound Webhooks
15 event types: threat.created/updated/deleted, mitigation.*, model.*, member.*, project.*

### CI/CD Integration
- GitHub, GitLab, Bitbucket webhook support
- `POST /api/ci/scan` — Trigger threat analysis from pipeline
- PR comments with scan results

---

## GitHub Repository Analysis

Point at a GitHub repo and AI generates a threat model:
1. Enter repo URL (https://github.com/owner/repo)
2. Backend scans repo tree for key files:
   - README, ARCHITECTURE.md (documentation)
   - Dockerfile, docker-compose.yml (container topology)
   - terraform/*.tf (infrastructure as code)
   - package.json, go.mod (dependencies)
   - Route files, DB schemas (application architecture)
3. AI extracts components, data flows, and trust boundaries
4. Auto-generates diagram with hierarchical layout

---

## Risk Register Export

Downloadable CSV for GRC tools (ServiceNow, Archer, OneTrust):

| Column | Description |
|--------|-------------|
| Risk ID | Unique threat identifier |
| Threat Name | Short descriptive name |
| Severity | CRITICAL/HIGH/MEDIUM/LOW |
| STRIDE Categories | Applicable STRIDE types |
| Mitigation Count | Total mitigations |
| Cumulative Effectiveness % | Combined mitigation coverage |
| Residual Risk % | Remaining risk after mitigations |
| Treatment Decision | Accept/Mitigate/In Progress/N/A |

---

## Document Import

### Supported Formats
- PDF (parsed with pdf-parse)
- DOCX (parsed with mammoth)
- Markdown, HTML, plain text
- URL (fetched and parsed)
- Images (vision AI for diagram extraction)

### AI Extraction Pipeline
1. Upload/paste document → parse text
2. AI extracts: components, data flows, trust boundaries, technologies, **security requirements**
3. Trust boundaries auto-classified (PUBLIC/INTERNAL/CONFIDENTIAL/RESTRICTED)
4. Model generator creates React Flow nodes + edges
5. Auto-layout in hierarchical grid
6. Runs as background job (user can navigate away)
7. Extracted requirements stored in canvas store for mitigation linking

### Smart Multi-Document Import (Merge Engine)

When importing a second or third document into a canvas that already has components:

1. **Fuzzy matching** — extracted components compared against existing canvas nodes using normalized string similarity
2. **Classification** — each extracted component marked as `add` (new), `update` (exists on canvas), or `skip` (duplicate)
3. **MergeReviewDialog** — user reviews the merge plan before any canvas changes, can toggle add/skip per item
4. **AI context** — existing component summary passed to AI extractor to reduce duplicates upstream
5. **Boundary dedup** — boundaries matched by name and trust level

**Files:** `services/merge-engine.ts`, `components/MergeReviewDialog.tsx` (16 unit tests)

### Requirement Extraction

During document import, security-relevant requirements are extracted from SRS/SAD:
- Uses the document's own numbering (e.g., `FR-12`, `SEC-3`)
- If no explicit requirement IDs exist, generates sequential IDs
- Categories: `security`, `functional`, `compliance`
- Stored as `ExtractedRequirement[]` in canvas store
- Available in EditMitigationDialog to link mitigations → requirements

---

## Micro-Analysis Pipeline

**Location:** `server/src/services/ai/micro-analysis/`

Per-component, per-category threat analysis with configurable methodologies.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  runMicroAnalysis()                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Load human-reviewed threats (respect prior decisions)    │
│ 2. Build ComponentContext for each component                │
│ 3. Extract sequence flows per component (no LLM)           │
│ 4. Per-component, per-category analysis (sequential)        │
│    ├── Phase 1: Research — OWASP, CWE, compliance lookup   │
│    ├── Phase 2: Rule-based STRIDE seeds (no LLM)           │
│    └── Phase 3: LLM per-category with reference injection  │
│ 5. Separate mitigation generation pass (per-threat)         │
│ 6. Supply chain + ML threats (rule-based, no LLM)          │
│ 7. Cross-component compound analysis                        │
│ 8. Severity calibration with full context                   │
│ 9. Persist to DB (human-in-the-loop)                       │
└─────────────────────────────────────────────────────────────┘
```

### Supported Methodologies

| Methodology | Categories | Description |
|-------------|-----------|-------------|
| STRIDE | 6 | Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege |
| PASTA | 8 | Business Logic, Data Exposure, Access Control, Injection, Supply Chain, Infrastructure, Insider Threat, Availability |
| Kill Chain | 6 | Reconnaissance, Delivery, Exploitation, Installation, C2, Actions on Objectives |
| MITRE ATT&CK | 11 | Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, Exfiltration, Impact |

### Confidence Loop

If the average confidence of threats from a category is below the threshold (default 0.7):
1. Build follow-up prompt showing existing threats and **unused** reference templates
2. LLM identifies missed threats
3. Results merged and deduplicated by name

### Per-Component Analysis Flow

For each component × methodology category:
1. **Reference lookup** — match component type + category to CWE database, OWASP entries, compliance requirements
2. **Seed threats** — rule-based STRIDE analyzer provides baseline
3. **LLM analysis** — focused prompt with component details, connections, sequence flows, and injected reference data
4. **0-3 threats per call** — prevents hallucination; empty array valid

### Separate Mitigation Pass

After all threats are identified, a dedicated pass generates mitigations:
- 2-4 mitigations per threat from **different control categories**
- Each mitigation has `testCriteria` ("Confirm that [condition]")
- Effectiveness capped at 0.85 per individual mitigation
- Example: Redis SPOOFING threat → [IAM] auth + [ENCRYPTION] TLS + [MONITORING] audit logging

### Supplemental Threats (No LLM)

**Supply Chain:** Generated from SOUP/dependency table — flags known CVE-prone packages, dependency confusion risks
**ML/AI:** For components tagged as AI/ML — data poisoning, model extraction, adversarial inputs

### Key Files

| File | Purpose |
|------|---------|
| `pipeline.ts` | Top-level orchestrator |
| `component-analyzer.ts` | Per-component analysis (research + seeds + LLM) |
| `category-analyzer.ts` | Single category analysis with confidence loop |
| `micro-prompt-builder.ts` | Builds focused <1500-token prompts with reference injection |
| `compound-analyzer.ts` | Cross-component attack chain analysis |
| `severity-calibrator.ts` | Full-context severity adjustment |
| `mitigation-analyzer.ts` | Per-threat mitigation generation |
| `supplemental-threats.ts` | Supply chain + ML rule-based threats |
| `types.ts` | MicroThreat, MicroAnalysisOptions, methodology constants |

---

## Human-in-the-Loop Threat Review

AI-generated threats go through a review workflow:

### Review States

| State | Meaning |
|-------|---------|
| `AI_SUGGESTED` | Generated by micro-analysis, pending human review |
| `AI_ACCEPTED` | Human confirmed the finding |
| `AI_REJECTED` | Human marked as false positive |
| `AI_MODIFIED` | Human edited the AI-generated threat |

### Behavior on Re-analysis

When micro-analysis runs again:
- **ACCEPTED** threats: skipped (not regenerated or overwritten)
- **REJECTED** threats: skipped (respect the decision)
- **MODIFIED** threats: skipped (human changes preserved)
- **AI_SUGGESTED** (unreviewed): updated if regenerated, created if new

### CVSS Auto-Scoring

During micro-analysis, CVSS 3.1 vectors are auto-generated from:
- Component type and trust zone
- Connection encryption and authentication
- Data classification (PII, PHI, PCI, credentials)

---

## Evidence Links & Requirement Traceability

### Evidence Links

Each mitigation can have multiple evidence links proving implementation:

| Type | Example |
|------|---------|
| `ticket` | JIRA-1234, GitHub issue #42 |
| `document` | SRS section 3.2, compliance policy |
| `screenshot` | Dashboard screenshot showing control |
| `test_report` | Penetration test results |
| `scan_result` | Nessus/Qualys vulnerability scan |
| `manual` | Manual verification notes |

Managed via **EditMitigationDialog** — add/remove inline, rendered as clickable links in **MitigationList**.

### Requirement Traceability

Mitigations can be linked to requirements extracted from imported documents:

```
SRS-9876543 FR-12: "System shall use TLS 1.3" → [ENCRYPTION] mitigation
SRS-9876543 SEC-3: "All data at rest encrypted"  → [ENCRYPTION] mitigation
SAD-8845213 SEC-1: "Service auth via mTLS"        → [IAM] mitigation
```

**Flow:**
1. Import SRS/SAD → AI extracts requirements with IDs
2. Requirements stored in canvas store (`extractedRequirements[]`)
3. Edit a mitigation → picker shows available requirements
4. Selected requirements saved as `requirementRefs` in DB
5. MitigationList renders requirement tags with docId + reqId

### API Fields

The mitigation update API (`PATCH /api/threats/:threatId/mitigations/:id`) accepts:
- `evidenceLinks`: `[{type, url, title}]`
- `requirementRefs`: `[{docId, reqId, text}]`
- `controlCategory`, `testCriteria`, `testResult`, `effectivenessScore`, `implementationNotes`

All JSON string fields (`evidenceLinks`, `requirementRefs`) are parsed by the repository layer before returning to the frontend.

---

## Document Lifecycle (April 2026)

**Location:** `features/documents/`, `server/src/api/threat-models/routes/documents.ts`

Documents imported into a threat model are now persisted and accessible throughout the model lifecycle.

### Features

- **Persistence:** Documents are stored with extracted text content (up to 500KB), metadata (name, type, size, page count), and extraction summary.
- **Docs Tab:** Right panel tab shows all imported documents with type badges, date, size, and requirement count.
- **Document Viewer:** Two-column dialog showing document text (left) and extracted requirements with coverage status (right).
- **Gap Analysis:** Dialog showing uncovered requirements grouped by source document, with CSV export.
- **Version-Linked Evidence:** Version snapshots capture which documents were present at snapshot time for audit traceability.
- **Re-extract:** Existing documents can be re-run through AI extraction to pick up changes.
- **Search/Filter:** Documents panel has a search input when 4+ documents are present.
- **Import triggers:** Both the toolbar "Import" button and the Docs panel "Add" button open the import dialog.

### Document Types

PDF, DOCX, MARKDOWN, TERRAFORM, DOCKER_COMPOSE, OPENAPI, YAML, TEXT, SOURCE_CODE

### API Endpoints

Endpoints: see [API Routes](#api-routes), group `/api/threat-models`.

---

## Code Security Analysis (April 2026)

**Location:** `features/requirements/components/ScanGithubDialog.tsx`, `UploadFilesDialog.tsx`, `server/src/services/code-scanner/`

### GitHub Repository Scanning

- Enter a GitHub repo URL with optional branch and token (for private repos)
- Fetches up to 30 security-relevant source files via GitHub API
- Scans for security control patterns (IAM, encryption, input validation, etc.)
- Creates COMPLETED mitigations with GitHub permalink evidence links
- Deduplicates against existing mitigations
- Persists scan as a SOURCE_CODE Document in the Docs tab

### Local File Upload Scanning

- Upload source files (.ts, .tsx, .js, .py, .go, .rb, .java, .cs, .php)
- Attach findings to a user-selected threat
- Same pattern detection engine as GitHub scanning
- Results persisted as Documents

### Pattern Library

The scanner detects patterns across 10 control categories with CWE references: IAM, ENCRYPTION, ACCESS_CONTROL, NETWORK, LOGGING, INPUT_VALIDATION, SECRETS, BACKUP, MONITORING, SUPPLY_CHAIN.

---

## AI Writing Style Preferences (April 2026)

**Location:** `app/(app)/profile/AIWritingStyleTab.tsx`, `server/src/services/ai/universal-system-prompt.ts`

Users can configure how AI writes threats and mitigations to match their organization's documentation style.

### Features

- Separate configuration for threat writing and mitigation writing
- Enable/disable toggle per style
- Tone selector: formal, concise, detailed, conversational
- Free-text examples field for each style
- Styles injected into the universal system prompt during AI execution
- Stored in user preferences (no schema migration needed)

**UI Location:** Profile → AI Style tab

---

## Methodology Selector (April 2026)

**Location:** `features/dashboard/components/CreateModelDialog.tsx`

When creating a new threat model, users can now select their preferred threat methodology:

- **STRIDE** (default) — Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege
- **PASTA** — Process for Attack Simulation and Threat Analysis
- **Kill Chain** — Reconnaissance through Actions on Objectives
- **MITRE ATT&CK** — Tactics, techniques, and procedures matrix

The selection is shown as a 2x2 card grid with icons and short descriptions.

---

## UX Improvements (April 2026)

### Tier 1 — Quick Wins
- Tooltips on all truncated text (documents, requirements, coverage, similar models)
- `Cmd+K` / `Ctrl+K` shortcut hint in command palette placeholder
- Audit log: expandable key-value details instead of raw JSON
- Audit log: date range filter (start/end date pickers)
- Cloud component palette: "Core" tab renamed to "Standard"
- Delete buttons always subtly visible (opacity-40 instead of hidden)
- CompletenessPanel loading skeleton
- Chat panel auto-scroll via bottom anchor ref
- Dashboard template cards with descriptive subtitles

### Tier 2 — Meaningful Gaps
- Methodology selector in Create Model dialog (STRIDE/PASTA/Kill Chain/MITRE ATT&CK)
- STRIDE explainer step in guided wizard (6 categories with icons and descriptions)
- Search/filter inputs in Requirements and Documents panels
- Memory sparkline charts in admin monitoring (15s auto-refresh)
- PDF export options dialog (choose sections to include)
- Similar Models panel enriched with last modified, open threats, project name

### Tier 3 — Structural
- Organization page: ScrollableTabs with overflow arrows (replaces 12 flat tabs)
- Review panel: inline comment threads with unresolved/resolved grouping, add comment form
- Import dialog: renamed tabs (Upload/Screenshot/URL/Paste), "what happens next" info box
- Import dropdown: clearer labels with descriptions for each import path

---

## API Routes

Every route the server registers, generated from the running app. Feature sections above link here instead of keeping their own endpoint lists.

<!-- BEGIN GENERATED ROUTES -->
_Generated from the registered Fastify routes by `npm run docs:routes` (run in `server/`). Do not edit by hand: `server/src/__tests__/api-docs-freshness.test.ts` fails when this section is stale._

544 routes in 44 groups. **Authz** is the route's `config.authz` declaration (see `server/src/middleware/authz-policy.ts`); grandfathered routes predate it.

### `/api` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api` | public (static version info) |  |

### `/api/admin` (34)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/admin/audit` | superAdmin |  |
| GET | `/api/admin/audit/export` | superAdmin |  |
| POST | `/api/admin/audit/purge` | superAdmin |  |
| POST | `/api/admin/cache/clear` | superAdmin |  |
| POST | `/api/admin/cache/invalidate/pattern` | superAdmin |  |
| POST | `/api/admin/cache/invalidate/tag` | superAdmin |  |
| GET | `/api/admin/cache/stats` | superAdmin |  |
| POST | `/api/admin/email/send-test` | superAdmin |  |
| POST | `/api/admin/email/test` | superAdmin |  |
| GET | `/api/admin/health` | superAdmin |  |
| GET | `/api/admin/oauth-providers` | superAdmin |  |
| DELETE | `/api/admin/oauth-providers/:provider` | superAdmin |  |
| PATCH | `/api/admin/oauth-providers/:provider` | superAdmin |  |
| GET | `/api/admin/oauth-providers/callback-urls` | superAdmin |  |
| GET | `/api/admin/organizations` | superAdmin |  |
| DELETE | `/api/admin/organizations/:orgId` | superAdmin |  |
| GET | `/api/admin/organizations/:orgId` | superAdmin |  |
| PATCH | `/api/admin/organizations/:orgId` | superAdmin |  |
| POST | `/api/admin/organizations/:orgId/members` | superAdmin |  |
| DELETE | `/api/admin/organizations/:orgId/members/:memberId` | superAdmin |  |
| PATCH | `/api/admin/organizations/:orgId/members/:memberId` | superAdmin |  |
| GET | `/api/admin/settings` | superAdmin |  |
| PUT | `/api/admin/settings` | superAdmin |  |
| GET | `/api/admin/stats` | superAdmin |  |
| GET | `/api/admin/system` | superAdmin |  |
| GET | `/api/admin/users` | superAdmin |  |
| DELETE | `/api/admin/users/:userId` | superAdmin |  |
| GET | `/api/admin/users/:userId` | superAdmin |  |
| PATCH | `/api/admin/users/:userId` | superAdmin |  |
| POST | `/api/admin/users/:userId/memberships` | superAdmin |  |
| DELETE | `/api/admin/users/:userId/memberships/:membershipId` | superAdmin |  |
| PATCH | `/api/admin/users/:userId/memberships/:membershipId` | superAdmin |  |
| POST | `/api/admin/users/:userId/super-admin` | superAdmin |  |
| POST | `/api/admin/users/bulk-invite` | superAdmin |  |

### `/api/ai` (8)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| POST | `/api/ai/context-analyze` | model:edit |  |
| POST | `/api/ai/extract` | handler (ACTIVE member of the requested organizationId (else the caller's default, else oldest ACTIVE org)) |  |
| POST | `/api/ai/extract-agentic` | handler (ACTIVE member of the requested organizationId (else the caller's default, else oldest ACTIVE org); that org's AI settings are used) |  |
| POST | `/api/ai/extract-diagram` | handler (ACTIVE member of the requested organizationId (else the caller's default, else oldest ACTIVE org)) |  |
| GET | `/api/ai/providers/:provider/models` | handler (any signed-in user; lists models from the server's env-configured LM Studio/Ollama, no tenant data) |  |
| GET | `/api/ai/providers/health` | handler (ACTIVE member of the requested organizationId (else the caller's default, else oldest ACTIVE org)) |  |
| GET | `/api/ai/stream/:modelId/chat` | model:view |  |
| GET | `/api/ai/vision-support` | handler (ACTIVE member of the requested organizationId (else the caller's default, else oldest ACTIVE org)) |  |

### `/api/ai-jobs` (6)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/ai-jobs` | authenticated |  |
| DELETE | `/api/ai-jobs/:jobId` | authenticated |  |
| GET | `/api/ai-jobs/:jobId` | authenticated |  |
| POST | `/api/ai-jobs/:jobId/pause` | authenticated |  |
| POST | `/api/ai-jobs/:jobId/retry` | authenticated |  |
| POST | `/api/ai-jobs/:jobId/retry-failed` | authenticated |  |

### `/api/attack-surface` (4)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/attack-surface/:modelId` | handler (ACTIVE member of the model's org (guests refused)) | Analyze attack surface of a threat model |
| GET | `/api/attack-surface/:modelId/high-risk` | handler (ACTIVE member of the model's org (guests refused)) | Get high-risk interfaces |
| GET | `/api/attack-surface/:modelId/interfaces` | handler (ACTIVE member of the model's org (guests refused)) | List attack surface interfaces |
| GET | `/api/attack-surface/:modelId/summary` | handler (ACTIVE member of the model's org (guests refused)) | Get attack surface summary |

### `/api/auth` (9)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| POST | `/api/auth/credentials` | public (pre-login; requires the account password, failures count toward the account lockout) |  |
| POST | `/api/auth/forgot-password` | public (pre-login; always returns the same response, emails only the account owner) |  |
| GET | `/api/auth/providers` | public (login page; returns only enabled provider names and signup flag, no secrets) |  |
| POST | `/api/auth/refresh` | public (the refresh token is the credential) |  |
| POST | `/api/auth/resend-verification` | public (pre-login; rate-limited, same response for every email, mails only the account's own address) |  |
| POST | `/api/auth/reset-password` | public (pre-login; the hashed, expiring reset token is the credential) |  |
| POST | `/api/auth/verification-status` | public (pre-login; reports only on the verification token supplied, email masked) |  |
| POST | `/api/auth/verify-email` | public (pre-login; caller proves ownership with the emailed single-use verification token) |  |
| POST | `/api/auth/verify-reset-token` | public (pre-login; the hashed, expiring reset token is the credential) |  |

### `/api/ci` (15)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/ci/api-keys` | org:VIEWER |  |
| POST | `/api/ci/api-keys` | org:ADMIN |  |
| DELETE | `/api/ci/api-keys/:keyId` | org:ADMIN |  |
| POST | `/api/ci/scan` | public (org CI API key (Bearer) with ci:scan scope; model must be in the key's org) |  |
| GET | `/api/ci/scans` | handler (ACTIVE member of the model's org (guests refused)) |  |
| GET | `/api/ci/scans/:scanId` | public (org CI API key (Bearer, any scope); scan must be in the key's org) |  |
| GET | `/api/ci/scans/:scanId/diff` | public (org CI API key (Bearer, any scope); scan must be in the key's org) |  |
| POST | `/api/ci/scans/:scanId/feedback` | org:ADMIN |  |
| DELETE | `/api/ci/webhook-secret` | org:ADMIN |  |
| GET | `/api/ci/webhook-secret` | org:VIEWER |  |
| POST | `/api/ci/webhook-secret` | org:ADMIN |  |
| POST | `/api/ci/webhooks/bitbucket/:organizationId` | public (HMAC-SHA256 X-Hub-Signature with the org CI webhook secret) |  |
| POST | `/api/ci/webhooks/github` | public (always 410 Gone, no processing) |  |
| POST | `/api/ci/webhooks/github/:organizationId` | public (HMAC-signed with the org CI webhook secret; 403 when unset) |  |
| POST | `/api/ci/webhooks/gitlab/:organizationId` | public (X-Gitlab-Token checked against the org CI webhook secret; 403 when unset) |  |

### `/api/compliance` (5)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/compliance/:modelId/:framework` | handler (ACTIVE member of the model's org (guests refused)) | Analyze threat model compliance |
| GET | `/api/compliance/:modelId/:framework/category/:categoryId` | handler (ACTIVE member of the model's org (guests refused)) | Get category compliance details |
| GET | `/api/compliance/:modelId/:framework/report` | handler (ACTIVE member of the model's org (guests refused)) | Generate compliance gap report |
| GET | `/api/compliance/:modelId/compare` | handler (ACTIVE member of the model's org (guests refused)) | Compare compliance across frameworks |
| GET | `/api/compliance/frameworks` | authenticated | List supported compliance frameworks |

### `/api/compliance-evidence` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| DELETE | `/api/compliance-evidence/evidence/:evidenceId` | handler ('delete' permission (canPerformAction) on the threat model that owns the evidence row; 404 when the evidence does not exist) |  |

### `/api/csrf-token` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/csrf-token` | authenticated |  |

### `/api/document-types` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/document-types/builtin` | authenticated |  |

### `/api/documents` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| POST | `/api/documents/parse` | authenticated |  |

### `/api/guest-access` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| POST | `/api/guest-access/validate` | handler (any signed-in user holding a valid, unexpired guest-access token (IP allowlist checked); returns only that grant's model id and role) | Validate a guest access token |

### `/api/invitations` (3)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/invitations` | authenticated | List pending invitations for the current user |
| POST | `/api/invitations/:token/accept` | handler (acceptInvitation: the token's invitation must be PENDING and addressed to the caller's email) | Accept an invitation to join an organization |
| POST | `/api/invitations/:token/decline` | handler (declineInvitation: the token's invitation must be PENDING and addressed to the caller's email) | Decline an invitation to join an organization |

### `/api/notifications` (10)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/notifications` | authenticated |  |
| DELETE | `/api/notifications/:notificationId` | authenticated |  |
| POST | `/api/notifications/integrations/slack` | superAdmin |  |
| POST | `/api/notifications/integrations/teams` | authenticated |  |
| GET | `/api/notifications/preferences` | authenticated |  |
| PATCH | `/api/notifications/preferences` | authenticated |  |
| POST | `/api/notifications/read` | authenticated |  |
| POST | `/api/notifications/read-all` | authenticated |  |
| GET | `/api/notifications/stats` | authenticated |  |
| POST | `/api/notifications/test` | authenticated |  |

### `/api/organizations` (116)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/organizations` | authenticated |  |
| POST | `/api/organizations` | authenticated |  |
| DELETE | `/api/organizations/:id` | org:OWNER |  |
| GET | `/api/organizations/:id` | org:VIEWER |  |
| PATCH | `/api/organizations/:id` | org:ADMIN |  |
| GET | `/api/organizations/:id/branding` | org:VIEWER |  |
| PUT | `/api/organizations/:id/branding` | org:ADMIN |  |
| POST | `/api/organizations/:id/transfer-ownership` | org:OWNER |  |
| GET | `/api/organizations/:organizationId/ai-usage` | org:ADMIN | Get AI usage summary for an organization |
| GET | `/api/organizations/:organizationId/audit` | org:ADMIN | Get audit logs for an organization |
| GET | `/api/organizations/:organizationId/audit/export` | org:OWNER | Export audit logs for compliance |
| GET | `/api/organizations/:organizationId/audit/stats` | org:ADMIN | Get audit log statistics |
| GET | `/api/organizations/:organizationId/invitations` | org:ADMIN | List pending invitations for an organization |
| POST | `/api/organizations/:organizationId/invitations` | org:ADMIN | Send an invitation to join an organization |
| DELETE | `/api/organizations/:organizationId/invitations/:invitationId` | handler (revokeInvitation: caller must be ACTIVE OWNER/ADMIN of the invitation's own org (URL organizationId is not used)) | Revoke a pending invitation |
| POST | `/api/organizations/:organizationId/leave` | handler (the caller's own membership (any status); the last owner cannot leave) | Leave an organization |
| GET | `/api/organizations/:organizationId/members` | org:VIEWER | List members of an organization |
| DELETE | `/api/organizations/:organizationId/members/:memberId` | handler (membership-service: caller's ACTIVE role in the membership's org must outrank the target; the membership must be in the URL org) | Remove a member from an organization |
| PATCH | `/api/organizations/:organizationId/members/:memberId` | handler (membership-service: caller's ACTIVE role in the membership's org must outrank the target; the membership must be in the URL org) | Update a member's role |
| DELETE | `/api/organizations/:organizationId/members/:memberId/suspend` | handler (membership-service: caller's ACTIVE role in the membership's org must outrank the target; the membership must be in the URL org) | Unsuspend a member |
| POST | `/api/organizations/:organizationId/members/:memberId/suspend` | handler (membership-service: caller's ACTIVE role in the membership's org must outrank the target; the membership must be in the URL org) | Suspend a member |
| GET | `/api/organizations/:organizationId/usage` | org:VIEWER | Get organization usage and quota information |
| GET | `/api/organizations/:organizationId/usage/summary` | org:VIEWER |  |
| GET | `/api/organizations/:organizationId/webhooks` | org:ADMIN |  |
| POST | `/api/organizations/:organizationId/webhooks` | org:ADMIN |  |
| DELETE | `/api/organizations/:organizationId/webhooks/:webhookId` | org:ADMIN |  |
| PATCH | `/api/organizations/:organizationId/webhooks/:webhookId` | org:ADMIN |  |
| POST | `/api/organizations/:organizationId/webhooks/:webhookId/test` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/ai-providers` | org:VIEWER |  |
| POST | `/api/organizations/:orgId/ai-providers` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/ai-providers/:providerId` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/ai-providers/:providerId` | org:VIEWER |  |
| PUT | `/api/organizations/:orgId/ai-providers/:providerId` | org:ADMIN |  |
| POST | `/api/organizations/:orgId/ai-providers/:providerId/test` | org:ADMIN |  |
| PUT | `/api/organizations/:orgId/ai-providers/reorder` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/ai-providers/usage` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/ai-settings` | org:VIEWER |  |
| PATCH | `/api/organizations/:orgId/ai-settings` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/ai-status` | org:VIEWER |  |
| GET | `/api/organizations/:orgId/ai/providers/health` | org:VIEWER |  |
| GET | `/api/organizations/:orgId/component-templates` | org:VIEWER |  |
| POST | `/api/organizations/:orgId/component-templates` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/component-templates/:libraryId` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/component-templates/:libraryId` | org:VIEWER |  |
| PATCH | `/api/organizations/:orgId/component-templates/:libraryId` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/component-templates/:libraryId/export` | org:VIEWER |  |
| GET | `/api/organizations/:orgId/component-templates/:libraryId/templates` | org:VIEWER |  |
| POST | `/api/organizations/:orgId/component-templates/:libraryId/templates` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/component-templates/:libraryId/templates/:templateId` | org:ADMIN |  |
| PATCH | `/api/organizations/:orgId/component-templates/:libraryId/templates/:templateId` | org:ADMIN |  |
| POST | `/api/organizations/:orgId/component-templates/import` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/document-types` | org:VIEWER |  |
| POST | `/api/organizations/:orgId/document-types` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/document-types/:docTypeId` | org:ADMIN |  |
| PATCH | `/api/organizations/:orgId/document-types/:docTypeId` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/encryption` | org:ADMIN |  |
| POST | `/api/organizations/:orgId/encryption/disable` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/encryption/keys` | org:ADMIN |  |
| POST | `/api/organizations/:orgId/encryption/keys` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/encryption/keys/:version` | org:ADMIN |  |
| POST | `/api/organizations/:orgId/encryption/rotate` | org:ADMIN |  |
| POST | `/api/organizations/:orgId/encryption/verify` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/freshness` | org:VIEWER |  |
| POST | `/api/organizations/:orgId/freshness/trigger` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/logo` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/logo` | org:VIEWER |  |
| POST | `/api/organizations/:orgId/logo` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/pipeline-executions/:executionId` | org:VIEWER |  |
| GET | `/api/organizations/:orgId/pipelines` | org:VIEWER |  |
| POST | `/api/organizations/:orgId/pipelines` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/pipelines/:pipelineId` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/pipelines/:pipelineId` | org:VIEWER |  |
| PATCH | `/api/organizations/:orgId/pipelines/:pipelineId` | org:ADMIN |  |
| POST | `/api/organizations/:orgId/pipelines/:pipelineId/execute` | org:EDITOR |  |
| GET | `/api/organizations/:orgId/pipelines/:pipelineId/executions` | org:VIEWER |  |
| POST | `/api/organizations/:orgId/pipelines/:pipelineId/stages` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/pipelines/:pipelineId/stages/:stageId` | org:ADMIN |  |
| PATCH | `/api/organizations/:orgId/pipelines/:pipelineId/stages/:stageId` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/prompt-logs` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/prompt-logs/:logId` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/prompt-stats` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/prompts` | org:VIEWER |  |
| POST | `/api/organizations/:orgId/prompts` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/prompts/:promptId` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/prompts/:promptId` | org:VIEWER |  |
| PATCH | `/api/organizations/:orgId/prompts/:promptId` | org:ADMIN |  |
| POST | `/api/organizations/:orgId/prompts/:promptId/clone` | org:ADMIN |  |
| POST | `/api/organizations/:orgId/prompts/execute` | org:VIEWER |  |
| POST | `/api/organizations/:orgId/prompts/preview` | org:VIEWER |  |
| GET | `/api/organizations/:orgId/risk-overview` | org:VIEWER |  |
| GET | `/api/organizations/:orgId/roles` | org:VIEWER |  |
| POST | `/api/organizations/:orgId/roles` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/roles/:roleId` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/roles/:roleId` | org:VIEWER |  |
| PATCH | `/api/organizations/:orgId/roles/:roleId` | org:ADMIN |  |
| POST | `/api/organizations/:orgId/roles/:roleId/assign` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/roles/:roleId/assign/:membershipId` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/scim` | org:ADMIN |  |
| POST | `/api/organizations/:orgId/scim/rotate` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/scim/token` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/shared-mitigations` | org:VIEWER | List shared control mitigations across the organization |
| DELETE | `/api/organizations/:orgId/sso` | org:OWNER |  |
| GET | `/api/organizations/:orgId/sso` | org:OWNER |  |
| PUT | `/api/organizations/:orgId/sso` | org:OWNER |  |
| GET | `/api/organizations/:orgId/sso/callback-url` | org:OWNER |  |
| POST | `/api/organizations/:orgId/sso/test` | org:OWNER |  |
| GET | `/api/organizations/:orgId/threat-libraries` | org:VIEWER |  |
| POST | `/api/organizations/:orgId/threat-libraries` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/threat-libraries/:libraryId` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/threat-libraries/:libraryId` | org:VIEWER |  |
| PATCH | `/api/organizations/:orgId/threat-libraries/:libraryId` | org:ADMIN |  |
| GET | `/api/organizations/:orgId/threat-libraries/:libraryId/export` | org:VIEWER |  |
| POST | `/api/organizations/:orgId/threat-libraries/:libraryId/templates` | org:ADMIN |  |
| DELETE | `/api/organizations/:orgId/threat-libraries/:libraryId/templates/:templateId` | org:ADMIN |  |
| PATCH | `/api/organizations/:orgId/threat-libraries/:libraryId/templates/:templateId` | org:ADMIN |  |
| POST | `/api/organizations/:orgId/threat-libraries/import` | org:ADMIN |  |

### `/api/permissions` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/permissions` | authenticated |  |

### `/api/pipelines` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/pipelines/builtin` | authenticated |  |

### `/api/presence` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/presence` | handler (counts only the requested models the caller can access) |  |

### `/api/projects` (23)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/projects` | handler (lists projects of the caller's ACTIVE memberships) |  |
| POST | `/api/projects` | org:EDITOR |  |
| DELETE | `/api/projects/:id` | handler (checkProjectAccess: ACTIVE ADMIN/OWNER of the project's org ('delete' permission)) |  |
| GET | `/api/projects/:id` | handler (checkProjectAccess: ACTIVE member (any role) of the project's org) |  |
| PATCH | `/api/projects/:id` | handler (org role with edit on the project) |  |
| POST | `/api/projects/:id/members` | handler (org role with manage on the project) |  |
| DELETE | `/api/projects/:id/members/:memberId` | handler (org role with manage on the project) |  |
| PATCH | `/api/projects/:id/members/:memberId` | handler (org role with manage on the project) |  |
| GET | `/api/projects/:projectId/scanners/findings` | handler (org role with view on the project) |  |
| POST | `/api/projects/:projectId/scanners/findings/:findingId/map` | handler (org role with edit on the project) |  |
| PATCH | `/api/projects/:projectId/scanners/findings/:findingId/status` | handler (org role with edit on the project) |  |
| GET | `/api/projects/:projectId/scanners/findings/stats` | handler (org role with view on the project) |  |
| GET | `/api/projects/:projectId/scanners/history` | handler (org role with view on the project) |  |
| POST | `/api/projects/:projectId/scanners/snyk/scan` | handler (org role with edit on the project) |  |
| POST | `/api/projects/:projectId/scanners/sonarqube/scan` | handler (org role with edit on the project) |  |
| POST | `/api/projects/:projectId/scanners/zap/import` | handler (org role with edit on the project) |  |
| GET | `/api/projects/:projectId/user-stories` | handler (org role with view on the project) |  |
| POST | `/api/projects/:projectId/user-stories` | handler (org role with edit on the project) |  |
| DELETE | `/api/projects/:projectId/user-stories/:storyId` | handler (org role with edit on the project) |  |
| GET | `/api/projects/:projectId/user-stories/:storyId` | handler (org role with view on the project) |  |
| PATCH | `/api/projects/:projectId/user-stories/:storyId` | handler (org role with edit on the project) |  |
| POST | `/api/projects/:projectId/user-stories/:storyId/data-flows` | handler (org role with edit on the project) |  |
| DELETE | `/api/projects/:projectId/user-stories/:storyId/data-flows/:dataFlowId` | handler (org role with edit on the project) |  |

### `/api/prompts` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/prompts/builtin` | authenticated |  |

### `/api/public` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/public/share/:token` | public (the unexpired ftm-share- token (sha256-matched to ModelAccess.accessToken) is the credential) |  |

### `/api/reporting` (9)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| POST | `/api/reporting/compare` | handler (only models of the caller's ACTIVE memberships) |  |
| GET | `/api/reporting/model/:modelId` | handler (ACTIVE member of the model's org (guests refused)) | Get model executive summary |
| POST | `/api/reporting/model/:modelId/generate` | handler (ACTIVE member of the model's org (guests refused)) |  |
| GET | `/api/reporting/model/:modelId/pdf` | handler (ACTIVE member of the model's org (guests refused)) | Generate PDF report |
| GET | `/api/reporting/organization/:orgId` | org:VIEWER | Get organization dashboard |
| GET | `/api/reporting/patterns/:orgId` | org:VIEWER | Recurring threat patterns across all models in an organization |
| GET | `/api/reporting/project/:projectId` | handler (ACTIVE member of the project's org) | Get project dashboard |
| GET | `/api/reporting/templates` | authenticated |  |
| GET | `/api/reporting/trends/:orgId` | org:VIEWER | Get trend data for charts |

### `/api/reviews` (10)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| POST | `/api/reviews` | model:edit |  |
| GET | `/api/reviews/:reviewId` | handler (view access to the review's threat model (canAccessReview)) |  |
| GET | `/api/reviews/:reviewId/activity` | handler (view access to the review's threat model (canAccessReview)) |  |
| POST | `/api/reviews/:reviewId/checklist` | handler (comment access to the review's threat model (reviewCaller)) |  |
| POST | `/api/reviews/:reviewId/comments` | handler (comment access to the review's threat model (reviewCaller)) |  |
| POST | `/api/reviews/:reviewId/comments/:commentId/resolve` | handler (comment access to the review's threat model (reviewCaller)) |  |
| POST | `/api/reviews/:reviewId/decision` | handler (view access to the review's threat model (canAccessReview)) |  |
| POST | `/api/reviews/:reviewId/sign-off` | handler (edit on the review's model and a SIGN_OFF_AUTHORITY assignment) |  |
| POST | `/api/reviews/:reviewId/start` | handler (view access to the review's threat model (canAccessReview)) |  |
| GET | `/api/reviews/pending` | authenticated |  |

### `/api/scim` (8)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/scim/v2/Groups` | public (no user session: the scim preHandler resolves the org from its SCIM bearer token) |  |
| GET | `/api/scim/v2/Groups/:id` | public (no user session: the scim preHandler resolves the org from its SCIM bearer token) |  |
| GET | `/api/scim/v2/ServiceProviderConfig` | public (no user session: the scim preHandler resolves the org from its SCIM bearer token) |  |
| GET | `/api/scim/v2/Users` | public (no user session: the scim preHandler resolves the org from its SCIM bearer token) |  |
| POST | `/api/scim/v2/Users` | public (no user session: the scim preHandler resolves the org from its SCIM bearer token) |  |
| DELETE | `/api/scim/v2/Users/:id` | public (no user session: the scim preHandler resolves the org from its SCIM bearer token) |  |
| GET | `/api/scim/v2/Users/:id` | public (no user session: the scim preHandler resolves the org from its SCIM bearer token) |  |
| PATCH | `/api/scim/v2/Users/:id` | public (no user session: the scim preHandler resolves the org from its SCIM bearer token) |  |

### `/api/setup` (3)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| POST | `/api/setup/initialize` | public (first-run only: refused once setupComplete; X-Setup-Token required in production when configured) |  |
| GET | `/api/setup/status` | public (setup booleans only, no tenant data) |  |
| POST | `/api/setup/test-ai` | public (first-run setup only; needs the setup token in production, refused once setupComplete, rate-limited) |  |

### `/api/supply-chain` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| POST | `/api/supply-chain/scan` | authenticated |  |

### `/api/threat-libraries` (10)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/threat-libraries` | handler (caller must hold an ACTIVE membership in at least one org (403 otherwise); lists libraries of the caller's ACTIVE orgs plus public and default libraries) |  |
| POST | `/api/threat-libraries` | handler (caller must have exactly one ACTIVE org and be ADMIN or OWNER of it (isActiveOrgAdmin)) |  |
| DELETE | `/api/threat-libraries/:libraryId` | handler (ACTIVE ADMIN or OWNER of the library's organization (isActiveOrgAdmin on library.organizationId); default libraries refused) |  |
| GET | `/api/threat-libraries/:libraryId` | handler (library must belong to one of the caller's ACTIVE orgs, or be public or default (404 otherwise)) |  |
| PATCH | `/api/threat-libraries/:libraryId` | handler (ACTIVE ADMIN or OWNER of the library's organization (isActiveOrgAdmin on library.organizationId); default libraries refused) |  |
| GET | `/api/threat-libraries/:libraryId/export` | handler (library is public or default, or belongs to an org where the caller is an ACTIVE member) |  |
| POST | `/api/threat-libraries/:libraryId/templates` | handler (ACTIVE OWNER/ADMIN of the org that owns :libraryId (library looked up; org-less/default libraries refused)) |  |
| DELETE | `/api/threat-libraries/:libraryId/templates/:templateId` | handler (ACTIVE OWNER/ADMIN of the org that owns :libraryId (library looked up; org-less/default libraries refused)) |  |
| PATCH | `/api/threat-libraries/:libraryId/templates/:templateId` | handler (ACTIVE OWNER/ADMIN of the org that owns :libraryId (library looked up; org-less/default libraries refused)) |  |
| POST | `/api/threat-libraries/import` | handler (ACTIVE ADMIN/OWNER of the caller's only ACTIVE org (400 when the caller has zero or several)) |  |

### `/api/threat-models` (150)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/threat-models` | handler (lists models of the caller's ACTIVE memberships) |  |
| POST | `/api/threat-models` | handler (EDITOR+ in the target project's organization) |  |
| DELETE | `/api/threat-models/:id` | model:delete |  |
| GET | `/api/threat-models/:id` | model:view |  |
| PATCH | `/api/threat-models/:id` | model:edit |  |
| GET | `/api/threat-models/:id/architectural-mitigations` | model:view |  |
| POST | `/api/threat-models/:id/architectural-mitigations` | model:edit |  |
| DELETE | `/api/threat-models/:id/architectural-mitigations/:mid` | model:edit |  |
| PATCH | `/api/threat-models/:id/architectural-mitigations/:mid` | model:edit |  |
| POST | `/api/threat-models/:id/architectural-mitigations/analyze` | model:edit |  |
| GET | `/api/threat-models/:id/attack-chains` | model:view |  |
| POST | `/api/threat-models/:id/attack-chains` | model:edit |  |
| DELETE | `/api/threat-models/:id/attack-chains/:chainId` | model:edit |  |
| GET | `/api/threat-models/:id/attack-chains/:chainId` | model:view |  |
| PATCH | `/api/threat-models/:id/attack-chains/:chainId` | model:edit |  |
| POST | `/api/threat-models/:id/attack-chains/analyze` | model:edit |  |
| GET | `/api/threat-models/:id/attestations` | model:view |  |
| POST | `/api/threat-models/:id/attestations` | model:edit |  |
| GET | `/api/threat-models/:id/branding` | model:view |  |
| GET | `/api/threat-models/:id/business-context` | model:view |  |
| PUT | `/api/threat-models/:id/business-context` | model:edit |  |
| GET | `/api/threat-models/:id/components` | model:view |  |
| GET | `/api/threat-models/:id/connections` | model:view |  |
| POST | `/api/threat-models/:id/duplicate` | handler (org member (not a guest) with edit on the model) |  |
| GET | `/api/threat-models/:id/export/yaml` | model:view |  |
| POST | `/api/threat-models/:id/inherit-threats` | model:edit |  |
| GET | `/api/threat-models/:id/interfaces` | model:view |  |
| GET | `/api/threat-models/:id/report.docx` | model:view |  |
| POST | `/api/threat-models/:id/save-canvas` | model:edit |  |
| GET | `/api/threat-models/:id/sequences` | model:view |  |
| POST | `/api/threat-models/:id/sequences` | model:edit |  |
| DELETE | `/api/threat-models/:id/sequences/:seqId` | model:edit |  |
| GET | `/api/threat-models/:id/sequences/:seqId` | model:view |  |
| PATCH | `/api/threat-models/:id/sequences/:seqId` | model:edit |  |
| POST | `/api/threat-models/:id/sequences/:seqId/messages` | model:edit |  |
| DELETE | `/api/threat-models/:id/sequences/:seqId/messages/:msgId` | model:edit |  |
| PATCH | `/api/threat-models/:id/sequences/:seqId/messages/:msgId` | model:edit |  |
| PUT | `/api/threat-models/:id/sequences/:seqId/messages/reorder` | model:edit |  |
| POST | `/api/threat-models/:id/sequences/:seqId/participants` | model:edit |  |
| DELETE | `/api/threat-models/:id/sequences/:seqId/participants/:partId` | model:edit |  |
| PATCH | `/api/threat-models/:id/sequences/:seqId/participants/:partId` | model:edit |  |
| POST | `/api/threat-models/:id/sequences/auto-generate` | model:edit |  |
| POST | `/api/threat-models/:id/sequences/generate` | model:edit |  |
| POST | `/api/threat-models/:id/set-parent` | model:edit |  |
| POST | `/api/threat-models/:id/share` | handler (org member (not a guest) with edit on the model) |  |
| DELETE | `/api/threat-models/:id/share/:shareId` | handler (org member (not a guest) with edit on the model) |  |
| GET | `/api/threat-models/:id/shares` | model:view |  |
| GET | `/api/threat-models/:id/stats` | model:view |  |
| PATCH | `/api/threat-models/:id/status` | model:edit |  |
| PATCH | `/api/threat-models/:id/tags` | model:edit |  |
| GET | `/api/threat-models/:id/versions` | model:view |  |
| POST | `/api/threat-models/:id/versions` | model:edit |  |
| GET | `/api/threat-models/:id/versions/:versionId` | model:view |  |
| PATCH | `/api/threat-models/:id/versions/:versionId` | model:edit |  |
| POST | `/api/threat-models/:id/versions/:versionId/restore` | model:edit |  |
| GET | `/api/threat-models/:id/versions/diff` | model:view |  |
| GET | `/api/threat-models/:modelId/ai-settings` | model:view |  |
| PATCH | `/api/threat-models/:modelId/ai-settings` | model:manage |  |
| GET | `/api/threat-models/:modelId/ai-status` | model:view |  |
| POST | `/api/threat-models/:modelId/ai/agentic-analysis` | model:edit |  |
| POST | `/api/threat-models/:modelId/ai/attack-tree` | model:edit |  |
| POST | `/api/threat-models/:modelId/ai/auto-suggest` | model:edit |  |
| GET | `/api/threat-models/:modelId/ai/available` | model:view |  |
| POST | `/api/threat-models/:modelId/ai/chat` | model:view |  |
| POST | `/api/threat-models/:modelId/ai/expert-analysis` | model:edit |  |
| POST | `/api/threat-models/:modelId/ai/micro-analysis` | model:edit |  |
| POST | `/api/threat-models/:modelId/ai/plan-diagrams` | model:edit |  |
| GET | `/api/threat-models/:modelId/ai/provider-info` | model:view |  |
| POST | `/api/threat-models/:modelId/ai/refine-threat` | model:edit |  |
| POST | `/api/threat-models/:modelId/ai/refresh-mitigations` | model:edit |  |
| POST | `/api/threat-models/:modelId/ai/rescore` | model:edit |  |
| POST | `/api/threat-models/:modelId/ai/severity-calculate` | model:edit |  |
| POST | `/api/threat-models/:modelId/ai/suggest-mitigations` | model:edit |  |
| POST | `/api/threat-models/:modelId/ai/suggest-questions` | model:edit |  |
| POST | `/api/threat-models/:modelId/ai/suggest-threats` | model:edit |  |
| POST | `/api/threat-models/:modelId/ai/synthesize` | model:edit |  |
| POST | `/api/threat-models/:modelId/ai/synthesize-hla` | model:edit |  |
| POST | `/api/threat-models/:modelId/bulk/components` | model:edit |  |
| DELETE | `/api/threat-models/:modelId/bulk/threats` | model:edit |  |
| POST | `/api/threat-models/:modelId/bulk/threats` | model:edit |  |
| PATCH | `/api/threat-models/:modelId/bulk/threats/severity` | model:edit |  |
| PATCH | `/api/threat-models/:modelId/bulk/threats/status` | model:edit |  |
| POST | `/api/threat-models/:modelId/citations/verify-batch` | model:edit |  |
| GET | `/api/threat-models/:modelId/compliance-evidence/:framework` | model:view |  |
| PUT | `/api/threat-models/:modelId/compliance-evidence/:framework/:controlId` | model:edit |  |
| POST | `/api/threat-models/:modelId/compliance-evidence/:framework/:controlId/evidence` | model:edit |  |
| POST | `/api/threat-models/:modelId/compliance-evidence/:framework/:controlId/verify` | model:edit |  |
| GET | `/api/threat-models/:modelId/dfds` | model:view |  |
| POST | `/api/threat-models/:modelId/dfds` | model:edit |  |
| DELETE | `/api/threat-models/:modelId/dfds/:dfdId` | model:edit |  |
| GET | `/api/threat-models/:modelId/dfds/:dfdId` | model:view |  |
| PATCH | `/api/threat-models/:modelId/dfds/:dfdId` | model:edit |  |
| POST | `/api/threat-models/:modelId/dfds/:dfdId/data-flows` | model:edit |  |
| DELETE | `/api/threat-models/:modelId/dfds/:dfdId/data-flows/:flowId` | model:edit |  |
| PATCH | `/api/threat-models/:modelId/dfds/:dfdId/data-flows/:flowId` | model:edit |  |
| POST | `/api/threat-models/:modelId/dfds/:dfdId/data-stores` | model:edit |  |
| DELETE | `/api/threat-models/:modelId/dfds/:dfdId/data-stores/:dataStoreId` | model:edit |  |
| PATCH | `/api/threat-models/:modelId/dfds/:dfdId/data-stores/:dataStoreId` | model:edit |  |
| POST | `/api/threat-models/:modelId/dfds/:dfdId/external-entities` | model:edit |  |
| DELETE | `/api/threat-models/:modelId/dfds/:dfdId/external-entities/:entityId` | model:edit |  |
| PATCH | `/api/threat-models/:modelId/dfds/:dfdId/external-entities/:entityId` | model:edit |  |
| POST | `/api/threat-models/:modelId/dfds/:dfdId/processes` | model:edit |  |
| DELETE | `/api/threat-models/:modelId/dfds/:dfdId/processes/:processId` | model:edit |  |
| PATCH | `/api/threat-models/:modelId/dfds/:dfdId/processes/:processId` | model:edit |  |
| GET | `/api/threat-models/:modelId/documents` | model:view |  |
| POST | `/api/threat-models/:modelId/documents` | model:edit |  |
| DELETE | `/api/threat-models/:modelId/documents/:docId` | model:edit |  |
| GET | `/api/threat-models/:modelId/documents/:docId` | model:view |  |
| GET | `/api/threat-models/:modelId/documents/gaps` | model:view |  |
| GET | `/api/threat-models/:modelId/gap-analysis` | model:view |  |
| POST | `/api/threat-models/:modelId/import-findings` | model:edit |  |
| GET | `/api/threat-models/:modelId/members` | model:view |  |
| GET | `/api/threat-models/:modelId/mitigations/:mitigationId/citations` | model:view |  |
| PATCH | `/api/threat-models/:modelId/mitigations/:mitigationId/citations/:citationId` | model:edit |  |
| GET | `/api/threat-models/:modelId/requirements` | model:view |  |
| POST | `/api/threat-models/:modelId/requirements` | model:edit |  |
| GET | `/api/threat-models/:modelId/requirements-coverage` | model:view |  |
| DELETE | `/api/threat-models/:modelId/requirements/:id` | model:edit |  |
| PATCH | `/api/threat-models/:modelId/requirements/:id` | model:edit |  |
| POST | `/api/threat-models/:modelId/requirements/bulk` | model:edit |  |
| POST | `/api/threat-models/:modelId/requirements/import/csv` | model:edit |  |
| POST | `/api/threat-models/:modelId/requirements/import/framework` | model:edit |  |
| GET | `/api/threat-models/:modelId/review-metrics` | model:view |  |
| GET | `/api/threat-models/:modelId/reviews` | model:view |  |
| POST | `/api/threat-models/:modelId/scan-code` | model:edit |  |
| POST | `/api/threat-models/:modelId/scan-from-github` | model:edit |  |
| POST | `/api/threat-models/:modelId/scanners/auto-map` | handler (org member (not a guest) with edit on the model) |  |
| GET | `/api/threat-models/:modelId/scanners/findings` | handler (org member (not a guest) with view on the model) |  |
| GET | `/api/threat-models/:modelId/threats` | model:view |  |
| POST | `/api/threat-models/:modelId/threats` | model:edit |  |
| DELETE | `/api/threat-models/:modelId/threats/:id` | model:edit |  |
| GET | `/api/threat-models/:modelId/threats/:id` | model:view |  |
| PATCH | `/api/threat-models/:modelId/threats/:id` | model:edit |  |
| PATCH | `/api/threat-models/:modelId/threats/:id/review` | model:edit |  |
| GET | `/api/threat-models/:modelId/threats/:threatId/citations` | model:view |  |
| PATCH | `/api/threat-models/:modelId/threats/:threatId/citations/:citationId` | model:edit |  |
| GET | `/api/threat-models/:modelId/threats/:threatId/comments` | model:view |  |
| POST | `/api/threat-models/:modelId/threats/:threatId/comments` | model:comment |  |
| DELETE | `/api/threat-models/:modelId/threats/:threatId/comments/:commentId` | model:view |  |
| GET | `/api/threat-models/:threatModelId/audit` | model:view | Get audit logs for a threat model |
| GET | `/api/threat-models/:threatModelId/guest-access` | model:view | List guest access for a threat model |
| POST | `/api/threat-models/:threatModelId/guest-access` | model:edit | Grant guest access to a threat model |
| DELETE | `/api/threat-models/:threatModelId/guest-access/:accessId` | handler (ACTIVE OWNER/ADMIN/EDITOR of the org owning the access record (accessId); :threatModelId is not checked) | Revoke guest access to a threat model |
| POST | `/api/threat-models/create-from-github` | handler (with body projectId: ACTIVE member of the project's org with edit permission (EDITOR+); without: uses the caller's first ACTIVE OWNER/ADMIN/EDITOR membership org) |  |
| POST | `/api/threat-models/import` | handler (EDITOR+ in the target project's organization) |  |
| POST | `/api/threat-models/import/docker-compose` | handler (EDITOR+ in the target project's organization) |  |
| POST | `/api/threat-models/import/kubernetes` | handler (EDITOR+ in the target project's organization) |  |
| POST | `/api/threat-models/import/terraform` | handler (EDITOR+ in the target project's organization) |  |
| POST | `/api/threat-models/import/tool` | handler (EDITOR+ in the target project's organization) |  |
| POST | `/api/threat-models/import/yaml` | handler (EDITOR+ in the target project's organization) |  |

### `/api/threats` (6)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/threats/:threatId/mitigations` | handler (view on the threat's model) |  |
| POST | `/api/threats/:threatId/mitigations` | handler (edit on the threat's model) |  |
| DELETE | `/api/threats/:threatId/mitigations/:id` | handler (edit on the threat's model) |  |
| GET | `/api/threats/:threatId/mitigations/:id` | handler (view on the threat's model) |  |
| PATCH | `/api/threats/:threatId/mitigations/:id` | handler (edit on the threat's model) |  |
| PATCH | `/api/threats/:threatId/mitigations/:id/move` | handler (edit on the threat's model) |  |

### `/api/users` (27)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/users/:userId/avatar` | handler (the user themselves, or anyone sharing an ACTIVE org with them) |  |
| GET | `/api/users/:userId/preferences` | authenticated |  |
| PATCH | `/api/users/:userId/preferences` | authenticated |  |
| DELETE | `/api/users/me` | authenticated |  |
| GET | `/api/users/me` | authenticated |  |
| PATCH | `/api/users/me` | authenticated |  |
| GET | `/api/users/me/api-tokens` | authenticated |  |
| POST | `/api/users/me/api-tokens` | authenticated |  |
| DELETE | `/api/users/me/api-tokens/:tokenId` | authenticated |  |
| PATCH | `/api/users/me/api-tokens/:tokenId` | authenticated |  |
| GET | `/api/users/me/api-tokens/scopes` | authenticated |  |
| DELETE | `/api/users/me/avatar` | authenticated |  |
| GET | `/api/users/me/avatar` | authenticated |  |
| POST | `/api/users/me/avatar` | authenticated |  |
| DELETE | `/api/users/me/data` | authenticated |  |
| GET | `/api/users/me/data-export` | authenticated |  |
| POST | `/api/users/me/data/cancel-deletion` | authenticated |  |
| POST | `/api/users/me/password` | authenticated |  |
| GET | `/api/users/me/preferences` | authenticated |  |
| PATCH | `/api/users/me/preferences` | authenticated |  |
| POST | `/api/users/me/sessions/revoke-all` | authenticated |  |
| POST | `/api/users/me/set-password` | authenticated |  |
| GET | `/api/users/me/two-factor` | authenticated |  |
| POST | `/api/users/me/two-factor/backup-codes` | authenticated |  |
| POST | `/api/users/me/two-factor/disable` | authenticated |  |
| POST | `/api/users/me/two-factor/enable` | authenticated |  |
| POST | `/api/users/me/two-factor/setup` | authenticated |  |

### `/api/v1` (2)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/v1` | authenticated |  |
| HEAD | `/api/v1/` | authenticated |  |

### `/api/v1/compliance` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/compliance/frameworks` | authenticated |  |

### `/api/v1/marketplace` (6)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/marketplace/categories` | authenticated | Browse public categories |
| GET | `/api/v1/marketplace/libraries` | authenticated | Browse public mitigation libraries |
| GET | `/api/v1/marketplace/libraries/:id` | authenticated | Get library detail |
| POST | `/api/v1/marketplace/publish` | org:ADMIN | Publish library to marketplace |
| GET | `/api/v1/marketplace/stats` | authenticated | Get marketplace statistics |
| GET | `/api/v1/marketplace/templates` | authenticated | Browse public model templates |

### `/api/v1/model-templates` (5)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/model-templates` | authenticated | List model templates |
| POST | `/api/v1/model-templates` | handler (org EDITOR for a private template, org ADMIN for a public one) | Create model template |
| DELETE | `/api/v1/model-templates/:id` | handler (template creator, or ACTIVE OWNER/ADMIN of the template's organization) | Delete model template |
| GET | `/api/v1/model-templates/:id` | handler (public templates for any signed-in user; private ones need ACTIVE membership of the template's org) | Get model template details |
| GET | `/api/v1/model-templates/categories` | handler (counts public templates and the caller's ACTIVE orgs' templates only) | List template categories |

### `/api/v1/organizations` (42)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/organizations/:orgId/custom-categories` | org:VIEWER | List custom threat categories |
| POST | `/api/v1/organizations/:orgId/custom-categories` | org:ADMIN | Create custom threat category |
| DELETE | `/api/v1/organizations/:orgId/custom-categories/:id` | org:ADMIN | Delete custom threat category |
| PATCH | `/api/v1/organizations/:orgId/custom-categories/:id` | org:ADMIN | Update custom threat category |
| POST | `/api/v1/organizations/:orgId/custom-categories/reorder` | org:ADMIN | Reorder custom threat categories |
| GET | `/api/v1/organizations/:orgId/integrations` | org:VIEWER | List integrations |
| POST | `/api/v1/organizations/:orgId/integrations` | org:ADMIN | Create integration |
| DELETE | `/api/v1/organizations/:orgId/integrations/:integrationId` | org:ADMIN | Delete integration |
| GET | `/api/v1/organizations/:orgId/integrations/:integrationId` | org:VIEWER | Get integration details |
| GET | `/api/v1/organizations/:orgId/integrations/:integrationId/mappings` | org:VIEWER | List integration mappings |
| GET | `/api/v1/organizations/:orgId/integrations/:integrationId/sync-logs` | org:VIEWER | Get sync logs |
| GET | `/api/v1/organizations/:orgId/integrations/available` | org:VIEWER | List available integration types |
| POST | `/api/v1/organizations/:orgId/integrations/github/analyze` | org:EDITOR |  |
| POST | `/api/v1/organizations/:orgId/integrations/github/configure` | org:ADMIN |  |
| POST | `/api/v1/organizations/:orgId/integrations/github/issues` | org:EDITOR |  |
| GET | `/api/v1/organizations/:orgId/integrations/github/labels` | org:VIEWER |  |
| POST | `/api/v1/organizations/:orgId/integrations/github/sync` | org:EDITOR |  |
| POST | `/api/v1/organizations/:orgId/integrations/github/sync/threat/:threatId` | org:EDITOR |  |
| POST | `/api/v1/organizations/:orgId/integrations/github/test` | org:VIEWER |  |
| POST | `/api/v1/organizations/:orgId/integrations/github/webhook` | public (HMAC-signed with the org webhook secret) |  |
| POST | `/api/v1/organizations/:orgId/integrations/infrastructure/webhook` | public (HMAC-signed with the org webhook secret) | Receive infrastructure change webhook and flag affected threats |
| POST | `/api/v1/organizations/:orgId/integrations/jira/configure` | org:ADMIN | Configure JIRA integration |
| GET | `/api/v1/organizations/:orgId/integrations/jira/issue-types` | org:VIEWER | List JIRA issue types |
| POST | `/api/v1/organizations/:orgId/integrations/jira/issues` | org:EDITOR | Create JIRA issue |
| GET | `/api/v1/organizations/:orgId/integrations/jira/projects` | org:VIEWER | List JIRA projects |
| GET | `/api/v1/organizations/:orgId/integrations/jira/status/:issueKey` | org:VIEWER | Get JIRA issue status |
| POST | `/api/v1/organizations/:orgId/integrations/jira/sync` | org:EDITOR | Bidirectional sync with JIRA |
| POST | `/api/v1/organizations/:orgId/integrations/jira/sync/mitigation/:mitigationId` | org:EDITOR | Sync mitigation to JIRA |
| POST | `/api/v1/organizations/:orgId/integrations/jira/sync/threat/:threatId` | org:EDITOR | Sync threat to JIRA |
| POST | `/api/v1/organizations/:orgId/integrations/jira/test` | org:VIEWER | Test JIRA connection |
| POST | `/api/v1/organizations/:orgId/integrations/jira/webhook` | public (HMAC-signed with the org webhook secret) | Receive Jira webhook and sync status to ThreatForge |
| GET | `/api/v1/organizations/:orgId/marketplace/subscriptions` | org:VIEWER | List organization subscriptions |
| POST | `/api/v1/organizations/:orgId/marketplace/subscriptions` | org:ADMIN | Subscribe to a library |
| DELETE | `/api/v1/organizations/:orgId/marketplace/subscriptions/:id` | org:ADMIN | Unsubscribe from library |
| GET | `/api/v1/organizations/:orgId/mitigation-libraries` | org:VIEWER | List mitigation libraries |
| POST | `/api/v1/organizations/:orgId/mitigation-libraries` | org:ADMIN | Create mitigation library |
| DELETE | `/api/v1/organizations/:orgId/mitigation-libraries/:libraryId` | org:ADMIN | Delete mitigation library |
| GET | `/api/v1/organizations/:orgId/mitigation-libraries/:libraryId/templates` | org:VIEWER | List mitigation templates |
| POST | `/api/v1/organizations/:orgId/mitigation-libraries/:libraryId/templates` | org:EDITOR | Create mitigation template |
| DELETE | `/api/v1/organizations/:orgId/mitigation-libraries/:libraryId/templates/:templateId` | org:ADMIN | Delete mitigation template |
| PATCH | `/api/v1/organizations/:orgId/mitigation-libraries/:libraryId/templates/:templateId` | org:EDITOR | Update mitigation template |
| POST | `/api/v1/organizations/mitigation-templates/search` | org:VIEWER | Search mitigation templates across libraries |

### `/api/v1/risk-frameworks` (5)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/risk-frameworks` | org:VIEWER | List risk frameworks |
| POST | `/api/v1/risk-frameworks` | org:ADMIN | Create risk framework |
| GET | `/api/v1/risk-frameworks/:frameworkId/presets` | handler (built-in frameworks for anyone signed in; an org framework needs ACTIVE membership) | Get framework factor presets |
| DELETE | `/api/v1/risk-frameworks/:id` | org:ADMIN | Delete risk framework |
| POST | `/api/v1/risk-frameworks/seed-defaults` | superAdmin | Seed default frameworks (admin only) |

### `/api/v1/risk-scores` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| POST | `/api/v1/risk-scores/calculate` | handler (edit on the threat's model) | Calculate risk score |

### `/api/v1/threat-models` (6)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/threat-models` | handler (lists only models in orgs where the caller is an active member) |  |
| GET | `/api/v1/threat-models/:id/compliance/:framework` | model:view |  |
| GET | `/api/v1/threat-models/:id/risk-summary` | model:view |  |
| GET | `/api/v1/threat-models/:id/threats` | model:view |  |
| POST | `/api/v1/threat-models/:modelId/save-as-template` | handler (org EDITOR for a private template, org ADMIN for a public one) | Save threat model as template |
| POST | `/api/v1/threat-models/from-template/:templateId` | handler (ACTIVE EDITOR+ of the org owning body projectId; template must be public or owned by that org) | Create threat model from template |

### `/api/v1/threats` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/threats/:threatId/risk-scores` | handler (view on the threat's model) | Get threat risk scores |

### `/api/webhooks` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/api/webhooks/events` | authenticated |  |

### `/health` (4)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/health` | public (health probe, no tenant data) |  |
| GET | `/health/dependencies` | public (no user session; METRICS_TOKEN bearer, off when unset) |  |
| GET | `/health/live` | public (health probe, no tenant data) |  |
| GET | `/health/ready` | public (health probe, no tenant data) |  |

### `/metrics` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/metrics` | public (no user session; METRICS_TOKEN bearer, off when unset) |  |

### `/ws` (1)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/ws/:modelId` | handler (verifies the ?token JWT and canAccessThreatModel; anonymous only outside production) |  |
<!-- END GENERATED ROUTES -->
