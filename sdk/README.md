# @threatforge/sdk

Official Node.js / TypeScript SDK for the [ThreatForge](https://threatforge.bpmforge.com) API.

## Installation

```bash
npm install @threatforge/sdk
# or
yarn add @threatforge/sdk
# or
pnpm add @threatforge/sdk
```

## Quick Start

```ts
import { ThreatForgeClient } from "@threatforge/sdk";

const client = new ThreatForgeClient({
  apiKey: "ftm_your_api_key",
  baseUrl: "https://threatforge.example.com", // your instance
  // For self-hosted: baseUrl: "https://your-domain.com"
});

// List all threat models
const { data: models } = await client.models.list();

// Get threats for a model
const threats = await client.threats.list(models[0].id, { severity: "HIGH" });

// Create a model from GitHub
const result = await client.models.createFromGithub(
  "https://github.com/your-org/your-repo",
);
console.log(`Created model: ${result.modelId}`);
```

## API Reference

### `client.models`

| Method | Description |
|--------|-------------|
| `list(params?)` | List all threat models |
| `get(modelId)` | Get a single model |
| `create(input)` | Create a new model |
| `update(modelId, input)` | Update model metadata |
| `delete(modelId)` | Delete a model |
| `export(modelId, format)` | Export as `json`, `yaml`, or `pdf` |
| `createFromGithub(repoUrl, token?)` | Scan GitHub repo and create model |

### `client.threats`

| Method | Description |
|--------|-------------|
| `list(modelId, params?)` | List threats in a model |
| `get(modelId, threatId)` | Get a single threat |
| `create(modelId, input)` | Add a threat |
| `update(modelId, threatId, input)` | Update a threat |
| `updateStatus(modelId, threatId, status)` | Change threat status |
| `delete(modelId, threatId)` | Delete a threat |
| `suggestThreats(modelId)` | Trigger AI threat suggestion job |

### `client.mitigations`

| Method | Description |
|--------|-------------|
| `list(threatId)` | List mitigations for a threat |
| `create(threatId, input)` | Add a mitigation |
| `update(threatId, mitigationId, input)` | Update a mitigation |
| `updateStatus(threatId, mitigationId, status)` | Change status |
| `delete(threatId, mitigationId)` | Delete a mitigation |

### `client.projects`

| Method | Description |
|--------|-------------|
| `list(params?)` | List projects |
| `get(projectId)` | Get a project |
| `create(input)` | Create a project |
| `update(projectId, input)` | Update a project |
| `delete(projectId)` | Delete a project |

## Error Handling

```ts
import { ThreatForgeError } from "@threatforge/sdk";

try {
  await client.models.get("nonexistent-id");
} catch (err) {
  if (err instanceof ThreatForgeError) {
    console.error(`${err.status}: ${err.message}`);
  }
}
```

## Getting an API Key

1. Log in to your ThreatForge instance
2. Go to **Settings → API Tokens**
3. Click **Generate Token** and choose appropriate scopes
4. Copy the token — it starts with `ftm_`

## Self-Hosted Configuration

```ts
const client = new ThreatForgeClient({
  apiKey: process.env.THREATFORGE_API_KEY!,
  baseUrl: "https://your-domain.com",
  timeout: 60_000, // 60 seconds
});
```

## TypeScript

The SDK ships full TypeScript types. No `@types` package needed.

```ts
import type { ThreatModel, Threat, Severity } from "@threatforge/sdk";
```
