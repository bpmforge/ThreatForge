# API Versioning Policy

## Current Structure

```
/api/                    → Core API (stable, unversioned)
/api/v1/                 → Extension API (new features, integrations)
```

### Core API (`/api/`)
Stable endpoints used by the frontend and direct integrations:
- `/api/threat-models` — CRUD, canvas sync, versioning
- `/api/threats`, `/api/mitigations` — Threat management
- `/api/projects`, `/api/organizations` — Project/org management
- `/api/auth/*` — Authentication
- `/api/ai/*` — AI suggestions
- `/api/setup/*` — Initial configuration

**Stability contract:** Core API endpoints follow backward-compatible evolution.
Breaking changes require a deprecation cycle (see below).

### Extension API (`/api/v1/`)
Newer features and third-party integrations:
- `/api/v1/integrations/` — GitHub, Jira sync
- `/api/v1/marketplace/` — Library marketplace
- `/api/v1/custom-categories/` — Custom threat taxonomies
- `/api/v1/mitigation-libraries/` — Reusable mitigations
- `/api/v1/risk-scoring/` — Risk framework calculations
- `/api/v1/model-templates/` — Model templates

**Stability contract:** v1 endpoints may evolve faster. Breaking changes bump to v2.

## Backward-Compatible Changes (No Version Bump)

These changes are safe to make without versioning:
- Adding new optional fields to response objects
- Adding new endpoints
- Adding new query parameters
- Adding new enum values (if clients handle unknown values gracefully)
- Adding new optional request body fields

## Breaking Changes (Require Version Bump)

These changes require a new version:
- Removing or renaming response fields
- Changing field types (string → number, etc.)
- Removing endpoints
- Changing required fields in request bodies
- Changing authentication scheme
- Changing error response format
- Changing status codes for existing operations

## Deprecation Lifecycle

1. **Announce:** Add `Sunset: <date>` header to deprecated endpoints. Update docs.
2. **Warning period:** Minimum 3 months for internal APIs, 6 months for external/public APIs.
3. **Monitor:** Log usage of deprecated endpoints to track migration progress.
4. **Remove:** Only after the warning period AND migration is confirmed complete.

### How to Deprecate an Endpoint

```typescript
// Add to route handler
reply.header('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
reply.header('Deprecation', 'true');
reply.header('Link', '</api/v2/resource>; rel="successor-version"');
```

## Response Format Standard

All endpoints follow the standardized format from `server/src/utils/api-response.ts`:

```json
// Success (single item)
{ "data": { ... } }

// Success (list with pagination)
{ "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5, "hasNext": true, "hasPrev": false } }

// Error
{ "error": "Not found", "code": "NOT_FOUND", "requestId": "abc123" }
```
