# API Reference

This document provides a complete reference for the ThreatForge REST API and WebSocket endpoints.

## Base URL

```
Development: http://localhost:3001
Production: https://api.your-domain.com
```

## Authentication

### Authentication Methods

| Method | Header/Cookie | Use Case |
|--------|---------------|----------|
| NextAuth Session | Cookie: `next-auth.session-token` | Frontend browser |
| Bearer Token | `Authorization: Bearer <token>` | API clients |
| CI API Key | `Authorization: Bearer ftm_<key>` | CI/CD pipelines |
| Guest Token | Query: `?token=<token>` | External sharing |

### Getting a Token

```bash
# Login and get JWT token
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

## Response Format

### Success Response

```json
{
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Error Response

```json
{
  "error": "Error message",
  "details": { ... }
}
```

### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (DELETE) |
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict |
| 500 | Server error |

---

## Threat Models

### List Threat Models

```http
GET /api/threat-models
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| search | string | Search by name |
| projectId | string | Filter by project |
| status | string | Filter by status |
| tags | string | Comma-separated tags |
| sortBy | string | Sort field (createdAt, updatedAt, name) |
| sortOrder | string | asc or desc |

**Response:**

```json
{
  "data": [
    {
      "id": "clx123...",
      "name": "API Security Model",
      "version": 3,
      "status": "DRAFT",
      "tags": ["api", "security"],
      "projectId": "clx456...",
      "project": { "id": "...", "name": "Project A" },
      "threatCount": 12,
      "openThreatCount": 5,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-20T15:30:00Z"
    }
  ],
  "pagination": { ... }
}
```

### Get Threat Model

```http
GET /api/threat-models/:id
```

**Response:**

```json
{
  "id": "clx123...",
  "name": "API Security Model",
  "version": 3,
  "status": "DRAFT",
  "tags": ["api", "security"],
  "canvasState": {
    "nodes": [...],
    "edges": [...],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  },
  "projectId": "clx456...",
  "createdById": "clx789...",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-20T15:30:00Z"
}
```

### Create Threat Model

```http
POST /api/threat-models
Content-Type: application/json

{
  "name": "New Threat Model",
  "projectId": "clx456...",
  "status": "DRAFT",
  "tags": ["web", "api"]
}
```

### Update Threat Model

```http
PUT /api/threat-models/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "status": "IN_REVIEW",
  "canvasState": { ... }
}
```

### Delete Threat Model

```http
DELETE /api/threat-models/:id
```

### Save Canvas (Quick Save)

```http
POST /api/threat-models/:id/save-canvas
Content-Type: application/json

{
  "canvasState": {
    "nodes": [...],
    "edges": [...],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

### Update Status

```http
PATCH /api/threat-models/:id/status
Content-Type: application/json

{
  "status": "PUBLISHED"
}
```

**Valid Statuses:** `DRAFT`, `IN_REVIEW`, `PUBLISHED`, `ARCHIVED`

### Update Tags

```http
PATCH /api/threat-models/:id/tags
Content-Type: application/json

{
  "tags": ["tag1", "tag2", "tag3"]
}
```

### Get Model Stats

```http
GET /api/threat-models/:id/stats
```

**Response:**

```json
{
  "totalThreats": 15,
  "openThreats": 5,
  "mitigatedThreats": 8,
  "acceptedThreats": 2,
  "bySeverity": {
    "CRITICAL": 2,
    "HIGH": 5,
    "MEDIUM": 6,
    "LOW": 2
  },
  "bySTRIDE": {
    "SPOOFING": 3,
    "TAMPERING": 2,
    "REPUDIATION": 1,
    "INFORMATION_DISCLOSURE": 4,
    "DENIAL_OF_SERVICE": 2,
    "ELEVATION_OF_PRIVILEGE": 3
  }
}
```

### Duplicate Threat Model

```http
POST /api/threat-models/:id/duplicate
Content-Type: application/json

{
  "name": "Copy of Model",
  "projectId": "clx456..."
}
```

### Import Threat Model

```http
POST /api/threat-models/import
Content-Type: application/json

{
  "projectId": "clx456...",
  "data": { ... }  // Exported JSON format
}
```

### Get Components

```http
GET /api/threat-models/:id/components
```

### Get Connections

```http
GET /api/threat-models/:id/connections
```

### Get Interfaces

```http
GET /api/threat-models/:id/interfaces
```

---

## Threats

### List Threats

```http
GET /api/threat-models/:modelId/threats
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| severity | string | Filter by severity |
| status | string | Filter by status |
| category | string | Filter by STRIDE category |
| componentNodeId | string | Filter by component |

**Response:**

```json
{
  "data": [
    {
      "id": "clx123...",
      "name": "SQL Injection",
      "description": "Attacker can inject SQL...",
      "strideCategories": ["TAMPERING", "INFORMATION_DISCLOSURE"],
      "severity": "HIGH",
      "status": "OPEN",
      "category": "Injection",
      "componentNodeId": "node-1",
      "connectionEdgeId": null,
      "cweIds": ["CWE-89"],
      "owaspIds": ["A03:2021"],
      "mitigations": [...],
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

### Get Threat

```http
GET /api/threat-models/:modelId/threats/:id
```

### Create Threat

```http
POST /api/threat-models/:modelId/threats
Content-Type: application/json

{
  "name": "SQL Injection",
  "description": "Attacker can inject malicious SQL...",
  "strideCategories": ["TAMPERING", "INFORMATION_DISCLOSURE"],
  "severity": "HIGH",
  "status": "OPEN",
  "componentNodeId": "node-1",
  "cweIds": ["CWE-89"],
  "owaspIds": ["A03:2021"]
}
```

### Update Threat

```http
PUT /api/threat-models/:modelId/threats/:id
Content-Type: application/json

{
  "name": "Updated name",
  "severity": "CRITICAL",
  "status": "MITIGATED"
}
```

### Delete Threat

```http
DELETE /api/threat-models/:modelId/threats/:id
```

---

## Mitigations

### List Mitigations

```http
GET /api/threats/:threatId/mitigations
```

### Create Mitigation

```http
POST /api/threats/:threatId/mitigations
Content-Type: application/json

{
  "description": "Use parameterized queries",
  "strategy": "PREVENTION",
  "status": "PLANNED",
  "priority": "HIGH",
  "assigneeId": "clx789...",
  "dueDate": "2024-02-01T00:00:00Z",
  "notes": "See OWASP guidelines"
}
```

**Strategies:** `PREVENTION`, `DETECTION`, `RESPONSE`, `RECOVERY`, `DETERRENCE`

**Statuses:** `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `VERIFIED`

**Priorities:** `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`

### Update Mitigation

```http
PATCH /api/threats/:threatId/mitigations/:id
Content-Type: application/json

{
  "description": "Updated control description",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "strategy": "PREVENTION",
  "notes": "Implementation notes",
  "controlCategory": "IAM",
  "testCriteria": "Confirm that all service accounts use certificate-based auth",
  "testResult": "PASS",
  "effectivenessScore": 0.55,
  "implementationNotes": "Deployed mTLS via Istio service mesh",
  "evidenceLinks": [
    {"type": "ticket", "url": "https://jira.example.com/PROJ-123", "title": "PROJ-123"},
    {"type": "scan_result", "url": "https://scans.example.com/report/456", "title": "Q2 pentest"}
  ],
  "requirementRefs": [
    {"docId": "SRS-9876543", "reqId": "SEC-3", "text": "All service-to-service calls authenticated"}
  ]
}
```

**Control Categories:** `IAM`, `ENCRYPTION`, `ACCESS_CONTROL`, `NETWORK`, `LOGGING`, `INPUT_VALIDATION`, `SECRETS`, `BACKUP`, `MONITORING`, `SUPPLY_CHAIN`

**Test Results:** `PASS`, `FAIL`, `PARTIAL`, `UNTESTED`

**Evidence Link Types:** `ticket`, `document`, `screenshot`, `test_report`, `scan_result`, `manual`

### Delete Mitigation

```http
DELETE /api/threats/:threatId/mitigations/:id
```

---

## Version History

### List Versions

```http
GET /api/threat-models/:id/versions
```

**Response:**

```json
{
  "data": [
    {
      "id": "clx123...",
      "version": 3,
      "changesSummary": "Added authentication threats",
      "createdById": "clx789...",
      "createdAt": "2024-01-20T15:30:00Z"
    }
  ]
}
```

### Get Version

```http
GET /api/threat-models/:id/versions/:versionId
```

**Response includes full `canvasState`**

### Create Version

```http
POST /api/threat-models/:id/versions
Content-Type: application/json

{
  "changesSummary": "Added DDoS threats"
}
```

### Restore Version

```http
POST /api/threat-models/:id/versions/:versionId/restore
```

---

## Projects

### List Projects

```http
GET /api/projects
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| search | string | Search by name |
| organizationId | string | Filter by organization |
| status | string | Filter by status (ACTIVE, ARCHIVED) |

### Get Project

```http
GET /api/projects/:id
```

### Create Project

```http
POST /api/projects
Content-Type: application/json

{
  "name": "Project Name",
  "description": "Project description",
  "organizationId": "clx456..."
}
```

### Update Project

```http
PATCH /api/projects/:id
Content-Type: application/json

{
  "name": "New Name",
  "status": "ARCHIVED"
}
```

### Delete Project

```http
DELETE /api/projects/:id
```

### Project Members

```http
# Add member
POST /api/projects/:id/members
Content-Type: application/json

{
  "userId": "clx789...",
  "role": "EDITOR"
}

# Update member role
PATCH /api/projects/:id/members/:memberId
Content-Type: application/json

{
  "role": "VIEWER"
}

# Remove member
DELETE /api/projects/:id/members/:memberId
```

---

## Organizations

### List Organizations

```http
GET /api/organizations
```

### Create Organization

```http
POST /api/organizations
Content-Type: application/json

{
  "name": "Acme Corp",
  "type": "TEAM"
}
```

**Types:** `PERSONAL`, `TEAM`, `ENTERPRISE`

### Update Organization

```http
PATCH /api/organizations/:id
Content-Type: application/json

{
  "name": "New Name",
  "settings": { ... }
}
```

### Delete Organization

```http
DELETE /api/organizations/:id
```

### Transfer Ownership

```http
POST /api/organizations/:id/transfer
Content-Type: application/json

{
  "newOwnerId": "clx789..."
}
```

---

## Members

### List Members

```http
GET /api/organizations/:organizationId/members
```

### Update Member Role

```http
PATCH /api/organizations/:organizationId/members/:memberId
Content-Type: application/json

{
  "role": "ADMIN"
}
```

**Roles:** `OWNER`, `ADMIN`, `EDITOR`, `VIEWER`

### Remove Member

```http
DELETE /api/organizations/:organizationId/members/:memberId
```

### Leave Organization

```http
POST /api/organizations/:organizationId/members/leave
```

---

## Invitations

### Send Invitation

```http
POST /api/organizations/:organizationId/invitations
Content-Type: application/json

{
  "email": "newuser@example.com",
  "role": "EDITOR"
}
```

### List Pending Invitations

```http
GET /api/organizations/:organizationId/invitations
```

### Accept Invitation (Public)

```http
POST /api/invitations/accept/:token
```

### Decline Invitation (Public)

```http
POST /api/invitations/decline/:token
```

### Revoke Invitation

```http
DELETE /api/organizations/:organizationId/invitations/:id
```

---

## Guest Access

### Grant Guest Access

```http
POST /api/threat-models/:threatModelId/guest-access
Content-Type: application/json

{
  "email": "guest@external.com",
  "role": "VIEWER",
  "canExport": false,
  "expiresAt": "2024-03-01T00:00:00Z",
  "allowedIps": ["192.168.1.0/24"],
  "allowedDomains": ["external.com"]
}
```

**Roles:** `VIEWER`, `COMMENTER`, `EDITOR`

### List Guest Access

```http
GET /api/threat-models/:threatModelId/guest-access
```

### Revoke Guest Access

```http
DELETE /api/threat-models/:threatModelId/guest-access/:id
```

### Validate Guest Token (Public)

```http
POST /api/guest/:token/validate
```

---

## Sequence Diagrams

### List Sequence Diagrams

```http
GET /api/threat-models/:modelId/sequence-diagrams
```

### Create Sequence Diagram

```http
POST /api/threat-models/:modelId/sequence-diagrams
Content-Type: application/json

{
  "name": "Login Flow",
  "description": "User authentication sequence"
}
```

### Update Sequence Diagram

```http
PUT /api/threat-models/:modelId/sequence-diagrams/:id
Content-Type: application/json

{
  "name": "Updated name"
}
```

### Delete Sequence Diagram

```http
DELETE /api/threat-models/:modelId/sequence-diagrams/:id
```

### Participants

```http
# Add participant
POST /api/threat-models/:modelId/sequence-diagrams/:id/participants
Content-Type: application/json

{
  "label": "User",
  "componentId": "node-1",
  "order": 0
}

# Update participant
PUT /api/threat-models/:modelId/sequence-diagrams/:id/participants/:participantId
Content-Type: application/json

{
  "label": "New Label"
}

# Delete participant
DELETE /api/threat-models/:modelId/sequence-diagrams/:id/participants/:participantId
```

### Messages

```http
# Add message
POST /api/threat-models/:modelId/sequence-diagrams/:id/messages
Content-Type: application/json

{
  "label": "Login request",
  "fromId": "participant-1",
  "toId": "participant-2",
  "messageType": "SYNC",
  "protocol": "HTTPS",
  "order": 0
}

# Update message
PUT /api/threat-models/:modelId/sequence-diagrams/:id/messages/:messageId

# Delete message
DELETE /api/threat-models/:modelId/sequence-diagrams/:id/messages/:messageId
```

**Message Types:** `SYNC`, `ASYNC`, `RETURN`, `SELF`, `CREATE`, `DESTROY`

---

## AI

### Get AI Suggestions

```http
POST /api/organizations/:orgId/ai/suggestions
Content-Type: application/json

{
  "modelId": "clx123...",
  "componentNodeId": "node-1"
}
```

### AI Chat

```http
POST /api/organizations/:orgId/ai/chat
Content-Type: application/json

{
  "modelId": "clx123...",
  "messages": [
    { "role": "user", "content": "What threats should I consider for this API?" }
  ]
}
```

---

## AI Providers

### List AI Providers

```http
GET /api/organizations/:orgId/ai-providers
```

### Create AI Provider

```http
POST /api/organizations/:orgId/ai-providers
Content-Type: application/json

{
  "name": "Production Claude",
  "type": "ANTHROPIC",
  "apiKey": "sk-ant-...",
  "model": "claude-3-opus",
  "isDefault": true
}
```

**Types:** `ANTHROPIC`, `OPENAI`, `GOOGLE`, `AZURE_OPENAI`, `OLLAMA`, `LMSTUDIO`, `OPENROUTER`, `CUSTOM`

### Update AI Provider

```http
PUT /api/organizations/:orgId/ai-providers/:id
Content-Type: application/json

{
  "name": "New Name",
  "isDefault": false
}
```

### Delete AI Provider

```http
DELETE /api/organizations/:orgId/ai-providers/:id
```

### Test AI Provider

```http
POST /api/organizations/:orgId/ai-providers/:id/test
```

---

## Audit Logs

### Query Audit Logs

```http
GET /api/organizations/:organizationId/audit
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| action | string | Filter by action |
| resourceType | string | Filter by resource type |
| userId | string | Filter by user |
| startDate | string | Start of date range |
| endDate | string | End of date range |

**Response:**

```json
{
  "data": [
    {
      "id": "clx123...",
      "action": "UPDATE",
      "resourceType": "THREAT_MODEL",
      "resourceId": "clx456...",
      "resourceName": "API Security Model",
      "userId": "clx789...",
      "userEmail": "user@example.com",
      "changes": {
        "name": { "old": "Old Name", "new": "New Name" }
      },
      "metadata": {
        "ip": "192.168.1.1",
        "userAgent": "Mozilla/5.0..."
      },
      "createdAt": "2024-01-20T15:30:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

## Webhooks

### List Webhooks

```http
GET /api/organizations/:organizationId/webhooks
```

### Create Webhook

```http
POST /api/organizations/:organizationId/webhooks
Content-Type: application/json

{
  "name": "Slack Notifications",
  "url": "https://hooks.slack.com/...",
  "events": ["threat.created", "model.exported"],
  "secret": "webhook-secret-123"
}
```

**Available Events:**
- `model.created`, `model.updated`, `model.deleted`, `model.exported`
- `threat.created`, `threat.updated`, `threat.deleted`
- `member.invited`, `member.joined`, `member.removed`
- `project.created`, `project.deleted`

### Update Webhook

```http
PUT /api/organizations/:organizationId/webhooks/:id
Content-Type: application/json

{
  "isActive": false
}
```

### Delete Webhook

```http
DELETE /api/organizations/:organizationId/webhooks/:id
```

### Test Webhook

```http
POST /api/webhooks/test/:id
```

---

## CI/CD Integration

### Run Scan

```http
POST /api/ci/scans
Authorization: Bearer ftm_xxx
Content-Type: application/json

{
  "threatModelId": "clx123...",
  "repositoryId": "owner/repo",
  "commitSha": "abc123...",
  "prNumber": 42,
  "failOnSeverity": "HIGH"
}
```

### Get Scan Results

```http
GET /api/ci/scans/:scanId
Authorization: Bearer ftm_xxx
```

### List Scans

```http
GET /api/ci/scans?threatModelId=clx123...
Authorization: Bearer ftm_xxx
```

### API Keys

```http
# Create API key
POST /api/ci/api-keys
Content-Type: application/json

{
  "name": "GitHub Actions",
  "scopes": ["ci:scan"]
}

# List API keys
GET /api/ci/api-keys

# Revoke API key
DELETE /api/ci/api-keys/:id
```

---

## User Settings

### Get Current User

```http
GET /api/users/me
```

### Update Profile

```http
PUT /api/users/me
Content-Type: application/json

{
  "name": "New Name",
  "avatarUrl": "https://..."
}
```

### Change Password

```http
POST /api/users/me/password
Content-Type: application/json

{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

### Get Preferences

```http
GET /api/users/me/preferences
```

### Update Preferences

```http
PUT /api/users/me/preferences
Content-Type: application/json

{
  "theme": "dark",
  "defaultView": "grid"
}
```

### Export Personal Data

```http
GET /api/users/me/data-export
```

---

## Two-Factor Authentication

### Enable 2FA

```http
POST /api/users/me/two-factor/enable
```

**Response:**

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": ["12345678", "87654321", ...]
}
```

### Disable 2FA

```http
POST /api/users/me/two-factor/disable
Content-Type: application/json

{
  "code": "123456",
  "password": "current password (required unless the account only uses SSO)"
}
```

---

## Sessions

### List Sessions

```http
GET /api/users/me/sessions
```

**Response:**

```json
{
  "data": [
    {
      "id": "clx123...",
      "browser": "Chrome",
      "os": "macOS",
      "device": "desktop",
      "ipAddress": "192.168.1.1",
      "city": "San Francisco",
      "country": "US",
      "isCurrent": true,
      "lastActiveAt": "2024-01-20T15:30:00Z",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### Revoke Session

```http
DELETE /api/users/me/sessions/:id
```

### Revoke All Sessions

```http
DELETE /api/users/me/sessions
```

---

## Admin Endpoints

**Note:** These endpoints require super admin privileges (`isSuperAdmin: true`).

### Dashboard & Health

```http
# Get system statistics
GET /api/admin/stats

# Get service health
GET /api/admin/health
```

### System Settings

```http
# Get all settings
GET /api/admin/settings

# Update settings (partial update supported)
PUT /api/admin/settings
Content-Type: application/json

{
  // General
  "allowSignups": true,
  "requireEmailVerification": true,
  "defaultUserRole": "VIEWER",
  "maxProjectsPerOrg": 50,

  // Security
  "sessionTimeoutHours": 24,
  "maxLoginAttempts": 5,
  "lockoutDurationMinutes": 15,
  "mfaRequired": false,

  // Password Policy
  "passwordMinLength": 12,
  "passwordRequireUppercase": true,
  "passwordRequireLowercase": true,
  "passwordRequireNumbers": true,
  "passwordRequireSpecialChars": false,

  // AI
  "enableAI": true,
  "aiProvider": "anthropic",

  // SSO
  "samlEnabled": false,
  "samlJacksonUrl": "http://localhost:5225",
  "samlProductId": "flow-threat-model",

  // IP Allowlist
  "ipAllowlistEnabled": false,
  "ipAllowlist": ["10.0.0.0/8", "192.168.1.0/24"],

  // Audit
  "auditRetentionDays": 90,

  // Email
  "emailProvider": "sendgrid",
  "emailFrom": "noreply@example.com",
  "emailConfig": { "apiKey": "SG.xxx" }
}
```

### User Management

```http
# List all users (paginated, with last login)
GET /api/admin/users?page=1&limit=20&search=john

# Update user (promote/demote, suspend)
PATCH /api/admin/users/:id
Content-Type: application/json

{
  "status": "SUSPENDED",
  "isSuperAdmin": false
}

# Delete user
DELETE /api/admin/users/:id

# Bulk import users via CSV
POST /api/admin/users/bulk-invite
Content-Type: application/json

{
  "csv": "email,role,organizationId\nuser1@example.com,EDITOR,org_123"
}

# Response
{
  "success": true,
  "totalProcessed": 1,
  "successCount": 1,
  "failureCount": 0,
  "results": [
    { "line": 2, "email": "user1@example.com", "success": true, "invitationId": "inv_xxx" }
  ]
}
```

### Organization Management

```http
# List all organizations
GET /api/admin/organizations?page=1&limit=20

# Delete organization (cascades all data)
DELETE /api/admin/organizations/:id
```

### System Audit

```http
# Get audit logs (paginated, filterable)
GET /api/admin/audit?page=1&limit=50&entityType=USER&action=LOGIN

# Purge old audit logs
POST /api/admin/audit/purge
Content-Type: application/json

{
  "retentionDays": 90
}
```

### OAuth Providers

```http
# Get OAuth callback URLs
GET /api/admin/oauth-providers/callback-urls

# Get configured providers
GET /api/admin/oauth-providers

# Update OAuth provider
PUT /api/admin/oauth-providers/:provider
Content-Type: application/json

{
  "enabled": true,
  "clientId": "xxx",
  "clientSecret": "yyy"
}
```

---

## WebSocket API

### Collaboration WebSocket

```
ws://localhost:3001/ws/:modelId?token=<jwt>
```

**Protocol:** Yjs binary sync protocol

**Message Types:**
- Sync step 1/2 (initial sync)
- Update (incremental changes)
- Awareness (cursor positions)

**Example (JavaScript):**

```javascript
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const doc = new Y.Doc()
const provider = new WebsocketProvider(
  'ws://localhost:3001',
  `ws/${modelId}`,
  doc,
  { params: { token: jwtToken } }
)

// Listen for changes
doc.on('update', (update) => {
  console.log('Document updated')
})
```

---

## V1 API (Versioned)

### Custom Categories

```http
GET    /api/v1/organizations/:orgId/custom-categories
POST   /api/v1/organizations/:orgId/custom-categories
PUT    /api/v1/organizations/:orgId/custom-categories/:id
DELETE /api/v1/organizations/:orgId/custom-categories/:id
```

### Mitigation Libraries

```http
GET    /api/v1/organizations/:orgId/mitigation-libraries
POST   /api/v1/organizations/:orgId/mitigation-libraries
PUT    /api/v1/organizations/:orgId/mitigation-libraries/:id
DELETE /api/v1/organizations/:orgId/mitigation-libraries/:id
```

### Model Templates

```http
GET    /api/v1/model-templates
POST   /api/v1/model-templates
PUT    /api/v1/model-templates/:id
DELETE /api/v1/model-templates/:id
```

### Risk Frameworks

```http
GET    /api/v1/risk-frameworks
POST   /api/v1/risk-frameworks
PUT    /api/v1/risk-frameworks/:id
```

### Marketplace

```http
GET /api/v1/marketplace/libraries
GET /api/v1/marketplace/templates
POST /api/v1/marketplace/upload
GET /api/v1/organizations/:orgId/marketplace/purchases
```

### Integrations

```http
GET    /api/v1/organizations/:orgId/integrations
POST   /api/v1/organizations/:orgId/integrations
PUT    /api/v1/organizations/:orgId/integrations/:id
DELETE /api/v1/organizations/:orgId/integrations/:id
POST   /api/v1/organizations/:orgId/integrations/:id/sync
```

### Public Data API (for CISO/GRC Integrations)

Token-authenticated endpoints for external systems. Auth: `Authorization: Bearer ftm_xxx`

**List Threat Models:**
```http
GET /api/v1/threat-models
GET /api/v1/threat-models?projectId=xxx
```

Response: `{ data: { models: [{ id, name, version, status, threatCount, projectId, createdAt, updatedAt }] } }`

**List Threats with Mitigations:**
```http
GET /api/v1/threat-models/:id/threats
```

Response includes each threat's mitigations with `effectivenessScore` (0.0-0.85) for residual risk calculation.

**Compliance Gap Analysis:**
```http
GET /api/v1/threat-models/:id/compliance/:framework
```

Supported frameworks: `SOC2`, `ISO27001`, `NIST_CSF`, `NIST_800_53`, `HIPAA`, `PCI_DSS`, `FDA_CYBER`, `OWASP_ASVS`, `CMMC`, `NIST_800_171`, `ISO_27701`, `CCPA`

Response: Full compliance analysis with per-control assessment, coverage %, gaps, and recommendations.

**Risk Register Export:**
```http
GET /api/v1/threat-models/:id/risk-summary
```

Response: Risk register with severity scores, residual risk %, treatment decisions. GRC-compatible format.

**List Supported Frameworks:**
```http
GET /api/v1/compliance/frameworks
```

Response: `{ data: { frameworks: [{ id, name, controlCount, categoryCount }] } }`

### GitHub Repo Analysis

```http
POST /api/v1/organizations/:orgId/integrations/github/analyze
```

Body: `{ owner: "github-owner", repo: "repo-name" }`

Scans repo for architecture-relevant files (README, Dockerfile, terraform, package.json, etc.) and feeds to AI extraction pipeline.

---

## Observability

### Health Check (Comprehensive)

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T15:30:00Z",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "database": {
      "status": "healthy",
      "latencyMs": 5
    },
    "redis": {
      "status": "healthy",
      "message": "Redis not configured (using in-memory)"
    },
    "connectionPool": {
      "status": "healthy",
      "message": "SQLite (no connection pooling)"
    },
    "memory": {
      "status": "healthy",
      "details": {
        "heapUsedMB": 128,
        "heapTotalMB": 256,
        "rssMB": 300,
        "heapUsagePercent": 50
      }
    },
    "cpu": {
      "status": "healthy",
      "details": {
        "userMicroseconds": 123456,
        "systemMicroseconds": 78901
      }
    }
  }
}
```

**PostgreSQL Connection Pool Response:**

When using PostgreSQL, the `connectionPool` check includes pool metrics:

```json
{
  "connectionPool": {
    "status": "healthy",
    "pool": {
      "provider": "postgresql",
      "totalConnections": 5,
      "idleConnections": 3,
      "waitingClients": 0,
      "maxConnections": 10
    },
    "details": {
      "utilization": "50%"
    }
  }
}
```

Pool status thresholds:
- `healthy`: Utilization < 90% and no waiting clients
- `degraded`: Utilization > 90% or waiting clients > 0
- `unhealthy`: Utilization = 100% and waiting clients > 5

**Status Values:** `healthy`, `degraded`, `unhealthy`

### Liveness Probe (Kubernetes)

```http
GET /health/live
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-20T15:30:00Z"
}
```

Use this endpoint for Kubernetes liveness probes. Always returns 200 if the process is running.

### Readiness Probe (Kubernetes)

```http
GET /health/ready
```

**Response (200):**

```json
{
  "ready": true,
  "checks": {
    "database": true,
    "redis": true
  }
}
```

**Response (503):**

```json
{
  "ready": false,
  "checks": {
    "database": false,
    "redis": true
  }
}
```

Use this endpoint for Kubernetes readiness probes. Returns 503 if any critical dependency is unhealthy.

### Dependency Check (Startup Verification)

```http
GET /health/dependencies
```

Use this endpoint during deployment to verify all required services are configured and accessible. More detailed than the readiness probe.

**Response (200):**

```json
{
  "ready": true,
  "checks": {
    "database": {
      "ok": true,
      "provider": "postgresql",
      "latencyMs": 5
    },
    "redis": {
      "ok": true,
      "required": true
    },
    "encryption": {
      "ok": true
    },
    "envVars": {
      "ok": true
    }
  }
}
```

**Response (503 - Not Ready):**

```json
{
  "ready": false,
  "checks": {
    "database": {
      "ok": false,
      "provider": "postgresql",
      "error": "Cannot connect to PostgreSQL at localhost:5432"
    },
    "redis": {
      "ok": true,
      "required": false
    },
    "encryption": {
      "ok": false,
      "error": "ENCRYPTION_KEY not set or too short (min 32 chars)"
    },
    "envVars": {
      "ok": false,
      "missing": ["JWT_SECRET"]
    }
  }
}
```

**Checks Performed:**
- `database`: Tests database connectivity and reports provider type
- `redis`: Checks Redis if `REDIS_URL` is configured
- `encryption`: Verifies `ENCRYPTION_KEY` is set in production (min 32 chars)
- `envVars`: Validates required environment variables (`JWT_SECRET`, `DATABASE_URL` in production)

### Prometheus Metrics

```http
GET /metrics
```

**Response (text/plain):**

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/threat-models",status="200"} 1523
http_requests_total{method="POST",route="/api/threats",status="201"} 342

# HELP http_request_duration_ms HTTP request duration in milliseconds
# TYPE http_request_duration_ms histogram
http_request_duration_ms_bucket{method="GET",route="/api/threat-models",le="50"} 1200
http_request_duration_ms_bucket{method="GET",route="/api/threat-models",le="100"} 1480
http_request_duration_ms_bucket{method="GET",route="/api/threat-models",le="500"} 1520
http_request_duration_ms_sum{method="GET",route="/api/threat-models"} 45230
http_request_duration_ms_count{method="GET",route="/api/threat-models"} 1523

# HELP db_connections_active Active database connections
# TYPE db_connections_active gauge
db_connections_active 5

# HELP memory_heap_used_bytes Memory heap used in bytes
# TYPE memory_heap_used_bytes gauge
memory_heap_used_bytes 134217728
```

Configure your Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: 'threatforge'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

### System Info (Admin)

```http
GET /api/admin/system
Authorization: Bearer <admin-token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "nodeVersion": "v20.10.0",
    "platform": "linux",
    "arch": "x64",
    "cpus": 8,
    "totalMemoryMB": 16384,
    "freeMemoryMB": 8192,
    "loadAverage": [1.5, 1.2, 1.0],
    "uptime": 86400,
    "pid": 12345
  }
}
```

## Prompt Library API

### Prompt Templates

#### List Prompts

```http
GET /api/organizations/:orgId/prompts
Authorization: Bearer <token>
```

Query parameters:
- `category` (optional): Filter by PromptCategory

**Response:**

```json
{
  "prompts": [
    {
      "id": "prompt_abc123",
      "name": "Threat Identification",
      "description": "Identify threats from architecture diagrams",
      "category": "THREAT_IDENTIFICATION",
      "outputFormat": "JSON",
      "temperature": 0.7,
      "maxTokens": 2000,
      "requiresVision": true,
      "tags": "[\"stride\", \"architecture\"]",
      "version": 1,
      "isBuiltIn": true,
      "isActive": true
    }
  ]
}
```

#### Get Prompt Details

```http
GET /api/organizations/:orgId/prompts/:promptId
Authorization: Bearer <token>
```

#### Create Prompt

```http
POST /api/organizations/:orgId/prompts
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Custom Threat Detector",
  "description": "Detects threats in cloud architecture",
  "category": "THREAT_IDENTIFICATION",
  "systemPrompt": "You are a security expert...",
  "userPromptTemplate": "Analyze this: {{document}}",
  "outputFormat": "JSON",
  "temperature": 0.7,
  "maxTokens": 2000
}
```

#### Clone Prompt

```http
POST /api/organizations/:orgId/prompts/:promptId/clone
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Custom Version"
}
```

#### Update Prompt

```http
PUT /api/organizations/:orgId/prompts/:promptId
Authorization: Bearer <token>
Content-Type: application/json
```

#### Delete Prompt

```http
DELETE /api/organizations/:orgId/prompts/:promptId
Authorization: Bearer <token>
```

### Pipelines

#### List Pipelines

```http
GET /api/organizations/:orgId/pipelines
Authorization: Bearer <token>
```

**Response:**

```json
{
  "pipelines": [
    {
      "id": "pipeline_abc123",
      "name": "Document Analysis Pipeline",
      "description": "Multi-stage document processing",
      "isSequential": true,
      "stopOnError": true,
      "timeout": 300000,
      "stageCount": 3,
      "tags": ["document", "analysis"],
      "isBuiltIn": false,
      "isActive": true
    }
  ]
}
```

#### Get Pipeline with Stages

```http
GET /api/organizations/:orgId/pipelines/:pipelineId
Authorization: Bearer <token>
```

**Response:**

```json
{
  "pipeline": {
    "id": "pipeline_abc123",
    "name": "Document Analysis Pipeline",
    "stages": [
      {
        "id": "stage_1",
        "name": "Classification",
        "order": 0,
        "promptTemplateId": "prompt_classify",
        "inputMapping": {},
        "outputFields": ["documentType", "confidence"],
        "optional": false,
        "retryCount": 2
      },
      {
        "id": "stage_2",
        "name": "Extraction",
        "order": 1,
        "promptTemplateId": "prompt_extract",
        "inputMapping": {
          "docType": { "source": "stage_1", "field": "documentType" }
        },
        "outputFields": ["components", "connections"],
        "optional": false,
        "retryCount": 1
      }
    ]
  }
}
```

#### Create Pipeline

```http
POST /api/organizations/:orgId/pipelines
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Pipeline",
  "description": "Custom processing pipeline",
  "isSequential": true,
  "stopOnError": true,
  "timeout": 300000,
  "stages": [
    {
      "name": "Stage 1",
      "order": 0,
      "promptTemplateId": "prompt_abc123"
    }
  ]
}
```

#### Update Pipeline

```http
PUT /api/organizations/:orgId/pipelines/:pipelineId
Authorization: Bearer <token>
Content-Type: application/json
```

#### Delete Pipeline

```http
DELETE /api/organizations/:orgId/pipelines/:pipelineId
Authorization: Bearer <token>
```

#### Execute Pipeline

```http
POST /api/organizations/:orgId/pipelines/:pipelineId/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "inputDocument": "Document content here...",
  "inputMetadata": {
    "filename": "architecture.md"
  },
  "threatModelId": "model_abc123"
}
```

**Response:**

```json
{
  "execution": {
    "id": "exec_abc123",
    "status": "COMPLETED",
    "outputs": {
      "stage_1": { "documentType": "architecture" },
      "stage_2": { "components": [...] }
    },
    "finalResult": { "merged": "result" },
    "totalDurationMs": 5230,
    "totalTokensUsed": 3500,
    "stageResults": [
      {
        "stageId": "stage_1",
        "stageName": "Classification",
        "status": "COMPLETED",
        "durationMs": 1200,
        "tokensUsed": 800
      }
    ]
  }
}
```

#### Get Pipeline Executions

```http
GET /api/organizations/:orgId/pipelines/:pipelineId/executions
Authorization: Bearer <token>
```

Query parameters:
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset

#### Get Execution Details

```http
GET /api/organizations/:orgId/pipeline-executions/:executionId
Authorization: Bearer <token>
```

**Response:**

```json
{
  "execution": {
    "id": "exec_abc123",
    "pipelineId": "pipeline_abc123",
    "status": "COMPLETED",
    "currentStageId": null,
    "outputs": {},
    "finalResult": {},
    "totalDurationMs": 5230,
    "totalTokensUsed": 3500,
    "startedAt": "2024-01-20T10:30:00Z",
    "completedAt": "2024-01-20T10:30:05Z"
  },
  "stages": [
    {
      "id": "stageexec_1",
      "stageId": "stage_1",
      "order": 0,
      "status": "COMPLETED",
      "outputParsed": { "documentType": "architecture" },
      "durationMs": 1200,
      "tokensUsed": 800,
      "retryAttempts": 0
    }
  ]
}
```

### Pipeline Stages

#### Add Stage

```http
POST /api/organizations/:orgId/pipelines/:pipelineId/stages
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Stage",
  "order": 2,
  "promptTemplateId": "prompt_abc123",
  "inputMapping": {},
  "outputFields": ["result"],
  "optional": false,
  "retryCount": 1
}
```

#### Update Stage

```http
PUT /api/organizations/:orgId/pipelines/:pipelineId/stages/:stageId
Authorization: Bearer <token>
Content-Type: application/json
```

#### Delete Stage

```http
DELETE /api/organizations/:orgId/pipelines/:pipelineId/stages/:stageId
Authorization: Bearer <token>
```

---

## Setup API

The Setup API enables initial system configuration for fresh deployments. These endpoints are used during first-time setup and are rate-limited for security.

### Check Setup Status

```http
GET /api/setup/status
```

**Response (Setup Needed):**

```json
{
  "complete": false,
  "step": "initial",
  "canSetup": true
}
```

**Response (Already Complete):**

```json
{
  "complete": true,
  "organization": "Acme Corp",
  "adminEmail": "admin@acme.com"
}
```

### Initialize System

```http
POST /api/setup/initialize
Content-Type: application/json
X-Setup-Token: <token>  # Required in production (set SETUP_TOKEN, or use the token printed in the server log)

{
  "admin": {
    "email": "admin@example.com",
    "password": "SecurePassword123!",
    "name": "Admin User"
  },
  "organization": {
    "name": "Acme Corp",
    "slug": "acme-corp"
  }
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Setup complete",
  "organization": {
    "id": "org_abc123",
    "name": "Acme Corp",
    "slug": "acme-corp"
  },
  "admin": {
    "id": "user_abc123",
    "email": "admin@example.com"
  }
}
```

**Rate Limit:** 5 requests per 15 minutes

**Password Requirements:**
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (configurable)

### Test AI Provider

```http
POST /api/setup/test-ai
Content-Type: application/json

{
  "provider": "ANTHROPIC",
  "apiKey": "sk-ant-xxx",
  "model": "claude-3-opus"
}
```

**Response:**

```json
{
  "success": true,
  "message": "AI provider connected successfully",
  "model": "claude-3-opus",
  "latencyMs": 1200
}
```

**Rate Limit:** 10 requests per minute

### CLI Setup (Headless)

For automated deployments, use the CLI setup script:

```bash
# Check current setup status
npm run setup:cli -- --check

# Initialize with all options
npm run setup:cli -- \
  --admin-email admin@example.com \
  --admin-password "SecurePass123!" \
  --admin-name "Admin User" \
  --org-name "My Company" \
  --org-slug my-company

# JSON output for CI/CD
npm run setup:cli -- \
  --admin-email admin@example.com \
  --admin-password "SecurePass123!" \
  --org-name "My Company" \
  --json
```

**Exit Codes:**
| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Already setup |
| 2 | Validation error |
| 3 | Database error |

---

## Rate Limiting

API requests are rate limited:
- **Standard:** 100 requests/minute
- **AI endpoints:** 20 requests/minute
- **Auth endpoints:** 10 requests/minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705765200
```
