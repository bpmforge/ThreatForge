# threatforge (Python SDK)

Official Python client for the [ThreatForge](https://threatforge.bpmforge.com) API.
Zero runtime dependencies — uses only the Python standard library.

## Installation

```bash
pip install threatforge
```

## Quick Start

```python
from threatforge import ThreatForgeClient

client = ThreatForgeClient(api_key="ftm_your_key")

# List models
result = client.models.list()
for model in result["data"]:
    print(model["name"], "—", model["id"])

# Get threats for a model
threats = client.threats.list(model["id"], severity="HIGH")

# Create a model from GitHub
scan = client.models.create_from_github(
    "https://github.com/your-org/your-repo",
    token="ghp_...",  # optional, for private repos
)
print(f"Created model {scan['modelId']}, found {scan['scanned']} controls")
```

## Error Handling

```python
from threatforge import ThreatForgeError

try:
    client.models.get("nonexistent-id")
except ThreatForgeError as e:
    print(f"HTTP {e.status}: {e}")
```

## Self-Hosted

```python
client = ThreatForgeClient(
    api_key="ftm_...",
    base_url="https://your-domain.com",
    timeout=60,
)
```

## API Coverage

| Resource | Methods |
|----------|---------|
| `client.models` | `list`, `get`, `create`, `update`, `delete`, `create_from_github` |
| `client.threats` | `list`, `get`, `create`, `update`, `update_status`, `delete`, `suggest_threats` |
| `client.mitigations` | `list`, `create`, `update_status`, `delete` |
| `client.projects` | `list`, `get`, `create`, `delete` |
