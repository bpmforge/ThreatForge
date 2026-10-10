# ThreatForge Documentation

## Using ThreatForge

| Document | Description |
|----------|-------------|
| [User Guide](./USER_GUIDE.md) | Building threat models, AI analysis, reports |
| [Features](./FEATURES.md) | Feature catalog and the generated API route table |
| [`ftm` CLI](./FTM_CLI.md) | Validate a threat-model YAML file in CI |
| [UI Guide](./ui-guide/README.md) | Screen-by-screen walkthrough |

## Running ThreatForge

| Document | Description |
|----------|-------------|
| [Deployment](./DEPLOYMENT.md) | Single-server Docker Compose deployment and environment variables |
| [Cloud Deployment](./DEPLOYMENT_CLOUD.md) | GCP and AWS deployment |
| [Admin Runbook](./ADMIN_RUNBOOK.md) | Operations, encryption keys, backups, incident response |

## API

| Document | Description |
|----------|-------------|
| [API Reference](./API_REFERENCE.md) | REST endpoints |
| [API Versioning](./API_VERSIONING.md) | Versioning and deprecation policy |
| [Data Models](./DATA_MODELS.md) | Database schema |

## Architecture

| Document | Description |
|----------|-------------|
| [SADD](./architecture/SADD.md) | Software architecture design document (start here) |
| [Frontend](./architecture/FRONTEND_ARCHITECTURE.md) | Next.js and React Flow client |
| [Backend](./architecture/BACKEND_ARCHITECTURE.md) | Fastify API and services |
| [AI](./architecture/AI_ARCHITECTURE.md) | AI providers and the analysis pipeline |
| [Data](./architecture/DATA_ARCHITECTURE.md) | Multi-tenant data model |
| [Data Flows](./architecture/DATA_FLOWS.md) | Request and response sequences |
| [Diagrams](./architecture/DIAGRAMS.md) | Mermaid diagrams |
| [Containers](./diagrams/c2-containers.md), [Components](./diagrams/c3-components.md), [Entry Points](./diagrams/entry-points.md) | C4 views |

### Decisions

| ADR | Decision |
|-----|----------|
| [001](./architecture/decisions/ADR-001-react-flow.md) | React Flow for the canvas |
| [002](./architecture/decisions/ADR-002-zustand.md) | Zustand for client state |
| [003](./architecture/decisions/ADR-003-fastify.md) | Fastify for the API |
| [004](./architecture/decisions/ADR-004-yjs-collaboration.md) | Yjs for real-time collaboration |
| [005](./architecture/decisions/ADR-005-ai-multi-provider.md) | Multiple AI providers |
| [006](./architecture/decisions/ADR-006-threat-dedup-invariants.md) | Threat de-duplication invariants |
| [007](./architecture/decisions/ADR-007-remove-x6.md) | Remove the X6 canvas |
| [008](./architecture/decisions/ADR-008-keep-legacy-ai-pipeline.md) | Keep the legacy AI pipeline beside the agent chain |

## Product and Design

| Document | Description |
|----------|-------------|
| [Vision](./VISION.md) | Product vision and direction |
| [User Stories](./user-stories/USER_STORIES.md) | Stories and acceptance criteria |
| [User Flows](./design/USER_FLOWS.md) | Key journeys |
| [Wireframes](./design/WIREFRAMES.md) | Layouts and visual language |

## Reference

| Document | Description |
|----------|-------------|
| [Component Types](./reference/COMPONENT_TYPES.md) | Diagram component catalog |
| [STRIDE](./reference/STRIDE.md) | STRIDE methodology |
| [Risk Frameworks](./reference/RISK_FRAMEWORKS.md) | CVSS, DREAD, OWASP, FAIR and compliance frameworks |

## Contributing

| Document | Description |
|----------|-------------|
| [Contributing](../CONTRIBUTING.md) | How to contribute |
| [Getting Started](./development/GETTING_STARTED.md) | Local development setup |
| [Branching](./development/BRANCHING.md) | Branches, commits and pull requests |
| [Test Plan](./testing/TEST_PLAN.md) | Test strategy and suites |
| [Code-Health Ratchet](./process/CODE_HEALTH_RATCHET.md) | Duplicate and dead code checks in the gate |
