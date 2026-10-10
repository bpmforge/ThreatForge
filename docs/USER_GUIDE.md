# User Guide

This guide walks you through using ThreatForge to create and manage security threat models.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Your First Threat Model](#creating-your-first-threat-model)
3. [Building the Architecture Diagram](#building-the-architecture-diagram)
4. [Adding Trust Boundaries](#adding-trust-boundaries)
5. [Identifying Threats](#identifying-threats)
6. [Managing Mitigations](#managing-mitigations)
7. [Using AI Features](#using-ai-features)
8. [Configuring AI Prompts](#configuring-ai-prompts)
9. [Collaboration](#collaboration)
10. [Exporting and Sharing](#exporting-and-sharing)
11. [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Getting Started

### Logging In

1. Navigate to the ThreatForge URL
2. Enter your email and password
3. If 2FA is enabled, enter the code from your authenticator app
4. You'll land on the Dashboard

### Dashboard Overview

The dashboard shows:
- **Stats Cards** - Total models, open threats, recent activity
- **Recent Models** - Quick access to recently edited models
- **Quick Actions** - Create new model, import existing
- **Activity Feed** - Recent changes across your organization

### Navigation

Use the left sidebar to navigate:
- **Dashboard** - Overview and recent models
- **Projects** - Organize models by project
- **Templates** - Start from pre-built templates
- **Libraries** - Browse threat and component libraries
- **Settings** - Configure AI providers and preferences
- **Admin** - System administration (if admin)

---

## Creating Your First Threat Model

### Method 1: From Dashboard

1. Click **"New Model"** button on the dashboard
2. Enter a name for your threat model
3. Choose a threat methodology (STRIDE, PASTA, Kill Chain, or MITRE ATT&CK — defaults to STRIDE)
4. Optionally select a project
5. Click **"Create"**

### Method 2: From Project

1. Navigate to **Projects** in the sidebar
2. Select or create a project
3. Click **"New Threat Model"** within the project
4. Enter name and create

### Method 3: Import Architecture Document

1. Open a model and click **"Import"** in the toolbar
2. Choose **"Architecture Document"** for PDFs, DOCX, Markdown, Terraform, images, URLs, or pasted text
3. Or choose **"Existing Diagram File"** for Draw.io, Mermaid, or Lucidchart exports
4. AI extracts components, connections, and security requirements
5. If the canvas already has components, review the merge before changes are applied
6. The document is saved in the **Docs** tab for reference and can be re-extracted later

---

## Building the Architecture Diagram

### The Canvas

The main workspace is a drag-and-drop canvas powered by React Flow:

- **Zoom** - Mouse wheel or pinch gesture
- **Pan** - Click and drag on empty space
- **Select** - Click on components
- **Multi-select** - Shift+click or drag selection box

### Adding Components

1. Open the **Component Palette** (left panel)
2. Browse or search for component types
3. Drag a component onto the canvas
4. Or double-click to add at center

#### Component Categories

- **DFD Elements** - Actor, Process, Data Store, etc.
- **Application** - Web apps, APIs, microservices
- **Data** - Databases, caches, queues
- **Network** - Load balancers, firewalls, gateways
- **Security** - IAM, KMS, auth services
- **Infrastructure** - Containers, VMs, K8s
- **AWS** - 60+ AWS service components

### Editing Components

1. Select a component (click on it)
2. The **Properties Panel** opens on the right
3. Edit:
   - **Name** - Display label
   - **Type** - Component category
   - **Trust Level** - Internal, External, Untrusted
   - **Description** - Details about the component
   - **Interfaces** - Network endpoints (ports, protocols)

### Creating Connections (Data Flows)

1. Hover over a component to see connection handles
2. Click and drag from a handle
3. Drop onto another component's handle
4. A connection (edge) is created

### Editing Connections

1. Select a connection (click on the line)
2. Properties Panel shows connection details
3. Edit:
   - **Label** - Connection description
   - **Protocol** - HTTP, HTTPS, gRPC, etc.
   - **Authentication** - None, JWT, mTLS, etc.
   - **Encrypted** - TLS enabled
   - **Data Types** - What data flows through

---

## Adding Trust Boundaries

Trust boundaries represent security zones in your architecture.

### Creating a Boundary

1. In the palette, find **"Trust Boundary"**
2. Drag onto the canvas
3. Resize by dragging the edges
4. Name the boundary (e.g., "DMZ", "Internal Network", "Cloud VPC")

### Grouping Components

1. Drag components inside the boundary
2. Components become children of the boundary
3. Moving the boundary moves all children
4. Boundaries can be nested

### Trust Levels

Assign trust levels to boundaries:
- **Internal** - Trusted network zone
- **External** - Semi-trusted (partners, DMZ)
- **Untrusted** - Public internet, unknown actors

### Why Boundaries Matter

- Threats often occur at boundary crossings
- Data flows crossing boundaries need extra scrutiny
- Helps identify where to apply controls

---

## Identifying Threats

### The Threat Panel

Open the **Threat Panel** (right sidebar, "Threats" tab):
- Lists all threats for the current model
- Filter by STRIDE category, severity, status
- Group by category, severity, or component

### Adding Threats Manually

1. In the Threat Panel, click **"Add Threat"**
2. Fill in:
   - **Name** - Short descriptive name
   - **Description** - Detailed explanation
   - **STRIDE Categories** - Select applicable categories
   - **Severity** - Critical, High, Medium, Low, Info
   - **Linked Element** - Component or connection
3. Click **"Create"**

### Adding from Threat Library

1. Click **"Add from Library"** in the Threat Panel
2. Browse the threat library
3. Filter by STRIDE category or component type
4. Select threats to add
5. They're linked to selected component

### Using AI Suggestions

1. Select a component on the canvas
2. Click **"AI Suggestions"** in the toolbar or context menu
3. AI analyzes the component and architecture
4. Review suggested threats
5. Accept or dismiss each suggestion

### Threat Properties

Each threat has:

| Property | Description |
|----------|-------------|
| Name | Short identifier |
| Description | Full explanation |
| STRIDE Categories | One or more categories |
| Severity | Risk level |
| Status | Open, Mitigated, Accepted, N/A |
| Linked Element | Component or connection |
| CWE IDs | Common Weakness Enumeration |
| OWASP IDs | OWASP Top 10 references |
| Risk Score | Calculated from framework |

### Threat Statuses

| Status | Meaning |
|--------|---------|
| Open | Needs to be addressed |
| Mitigated | Has mitigations in place |
| Accepted | Risk accepted (documented) |
| Not Applicable | Doesn't apply to this context |

---

## Managing Mitigations

### Adding Mitigations

1. Expand a threat in the Threat Panel
2. Click **"Add Mitigation"**
3. Fill in:
   - **Description** - What the mitigation does
   - **Strategy** - Prevention, Detection, Response, Recovery, Deterrence
   - **Status** - Planned, In Progress, Completed, Verified
   - **Priority** - Critical, High, Medium, Low
   - **Assignee** - Team member responsible
   - **Due Date** - Target completion date
4. Click **"Create"**

### Mitigation Strategies

| Strategy | Purpose | Example |
|----------|---------|---------|
| Prevention | Stop threats from occurring | Input validation |
| Detection | Identify when threats occur | Logging, monitoring |
| Response | React to detected threats | Incident playbook |
| Recovery | Restore after incidents | Backup restoration |
| Deterrence | Discourage threat actors | Warning messages |

### Tracking Progress

- Update status as work progresses
- Add notes for context
- Verify mitigations when deployed
- Review regularly in threat panel

### Using Mitigation Templates

1. Open the Mitigation Library (Settings → Libraries)
2. Browse pre-defined mitigations
3. Apply templates to threats
4. Customize as needed

---

## Using AI Features

### Configuring AI Providers

1. Go to **Settings → AI Providers**
2. Click **"Add Provider"**
3. Select provider type:
   - Anthropic (Claude)
   - OpenAI (GPT)
   - Google (Gemini)
   - Ollama (self-hosted)
4. Enter API key or endpoint URL
5. Test connection
6. Set as default if desired

### AI Threat Suggestions

1. Select one or more components
2. Click **"Get AI Suggestions"** or use keyboard shortcut
3. AI analyzes:
   - Component types
   - Data flows
   - Trust boundaries
   - Industry patterns
4. Review suggestions
5. Accept relevant threats

### AI Chat

1. Open the **AI Chat** panel (right sidebar)
2. Ask questions like:
   - "What threats should I consider for this API?"
   - "How can I mitigate SQL injection?"
   - "Explain the STRIDE methodology"
3. AI responds with context from your model

### Best Practices

- Review AI suggestions carefully
- AI provides starting points, not complete coverage
- Combine AI with manual analysis
- Use domain expertise to validate

---

## Configuring AI Prompts

Customize how AI analyzes your documents and generates threats.

### Accessing Prompt Configuration

1. Go to **Settings** (gear icon)
2. Select **AI Prompts** tab

### Managing Prompt Templates

The **Prompt Library** tab shows all available prompts:

1. **Built-in prompts** (lock icon) - Read-only, provided by the system
2. **Custom prompts** - Created by your organization

**To customize a built-in prompt:**
1. Click the prompt to view details
2. Click **"Clone"** to create a copy
3. Edit the cloned version
4. Save your changes

**Creating new prompts:**
1. Click **"New Prompt"**
2. Set the name, category, and description
3. Write the system prompt (AI's persona/instructions)
4. Write the user prompt template with `{{variables}}`
5. Configure output format (JSON, Text, Markdown)
6. Set temperature and token limits

### Building Pipelines

Pipelines chain multiple prompts for complex processing:

1. Go to the **Pipelines** tab
2. Click **"New Pipeline"**
3. Add stages:
   - Each stage uses one prompt template
   - Configure input mapping (use outputs from previous stages)
   - Set retry behavior and conditions
4. Test the pipeline with sample documents

**Example pipeline:**
- Stage 1: Classify document type
- Stage 2: Extract architecture components (uses classification result)
- Stage 3: Identify threats for each component

### Document Types

Configure automatic prompt selection based on document content:

1. Go to the **Document Types** tab
2. Create detection rules (keywords, patterns, file extensions)
3. Link each document type to a default prompt

### Viewing Execution History

The **Execution Logs** tab shows:
- All prompt executions with status
- Token usage and duration
- Success/failure rates
- Detailed input/output for debugging

---

## Collaboration

### Real-Time Editing

Multiple users can edit simultaneously:
- See other users' cursors
- Changes sync instantly
- No save conflicts

### Inviting Team Members

1. Go to **Organization → Members**
2. Click **"Invite Member"**
3. Enter email address
4. Select role (Viewer, Editor, Admin)
5. Send invitation

### Member Roles

| Role | Capabilities |
|------|--------------|
| Viewer | View models, export |
| Editor | Create, edit models |
| Admin | Manage members, settings |
| Owner | Full control, transfer ownership |

### Project-Level Access

Grant access to specific projects:
1. Go to project settings
2. Click **"Manage Members"**
3. Add members with project roles
4. Override organization-level access

### Guest Access (External Sharing)

Share with external stakeholders:
1. Open a threat model
2. Click **"Share"** in the toolbar
3. Enter guest email
4. Set access level (View/Comment/Edit)
5. Optionally set expiry date
6. Send invite link

---

## Exporting and Sharing

### Export Formats

| Format | Use Case |
|--------|----------|
| PDF | Reports, documentation |
| JSON | Import to other systems |
| YAML | Human-readable config |
| PNG | Images for presentations |
| SVG | Vector graphics |

### Exporting to PDF

1. Click **Export → PDF** in the toolbar
2. PDF includes:
   - Model metadata
   - Canvas diagram image
   - Threat summary table
   - Mitigation status
   - STRIDE breakdown
3. Print or save the PDF

### Exporting to JSON

1. Click **Export → JSON**
2. JSON file downloads
3. Can be re-imported later
4. Use for backup or migration

### Exporting Images

1. Click **Export → PNG** or **SVG**
2. Image of current canvas view
3. Use in presentations or documentation

---

## Version History

### Creating Versions

Save snapshots of your model:
1. Click **Version History** in the toolbar
2. Click **"Create Version"**
3. Enter a description of changes
4. Click **"Save"**

### Viewing History

1. Open **Version History** panel
2. See all saved versions with:
   - Version number
   - Date created
   - Creator name
   - Change summary

### Restoring Versions

1. Find the version to restore
2. Click **"Restore"**
3. Confirm the action
4. Canvas reverts to that state
5. A new version is created automatically

### Best Practices

- Create versions before major changes
- Use descriptive change summaries
- Version before presentations/reviews
- Export critical versions as backup

---

## Keyboard Shortcuts

### Canvas Navigation

| Shortcut | Action |
|----------|--------|
| `Scroll` | Zoom in/out |
| `Space + Drag` | Pan canvas |
| `F` | Fit view to content |
| `1` | Zoom to 100% |

### Selection

| Shortcut | Action |
|----------|--------|
| `Click` | Select element |
| `Shift + Click` | Add to selection |
| `Ctrl/Cmd + A` | Select all |
| `Escape` | Clear selection |

### Editing

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Delete/Backspace` | Delete selected |
| `Ctrl/Cmd + D` | Duplicate selected |
| `Ctrl/Cmd + C` | Copy |
| `Ctrl/Cmd + V` | Paste |

### Saving

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save model |
| `Ctrl/Cmd + Shift + S` | Save as new version |

### Panels

| Shortcut | Action |
|----------|--------|
| `[` | Toggle left panel |
| `]` | Toggle right panel |
| `T` | Open threats panel |
| `P` | Open properties panel |
| `?` | Show keyboard shortcuts |

---

## Tips and Best Practices

### Model Organization

- **One model per system** - Don't combine unrelated systems
- **Use projects** - Group related models
- **Name clearly** - Use descriptive names
- **Tag consistently** - Apply tags for filtering

### Threat Modeling Process

1. **Diagram first** - Build accurate architecture
2. **Identify assets** - What are you protecting?
3. **Define trust boundaries** - Where are security zones?
4. **Enumerate threats** - Use STRIDE per element
5. **Document mitigations** - How will you address each?
6. **Review regularly** - Update as system changes

### Diagram Best Practices

- Keep diagrams readable (not too crowded)
- Use consistent naming conventions
- Show all data flows, not just happy paths
- Include error handling paths
- Document external dependencies

### Threat Coverage

- Don't just focus on obvious threats
- Consider insider threats
- Include supply chain risks
- Think about failure modes
- Consider abuse cases

### Collaboration Tips

- Assign threat owners
- Set realistic due dates
- Review threats in team meetings
- Update status regularly
- Document decisions (especially "Accepted" risks)

---

## Security Reviews

ThreatForge includes a formal security review workflow for approval before release.

### Requesting a Review

1. Open a threat model
2. Click **Review → Request Review**
3. Select reviewers from your organization
4. Add context and comments
5. Submit the request

### Reviewing a Model

1. Open the model from your notifications
2. Review the architecture diagram
3. Check each threat and mitigation
4. Add comments or requests for changes
5. Approve or reject the review

### Sign-Off Process

For compliance, require formal sign-offs:
1. Configure required approvers in project settings
2. Track who approved and when
3. Export sign-off history for audits

---

## Compliance & Reporting

### Compliance Frameworks

Map threats to compliance frameworks:
- **SOC 2** - Trust services criteria
- **NIST CSF** - Cybersecurity framework
- **ISO 27001** - Information security
- **OWASP ASVS** - Application security

### Executive Dashboards

Access high-level security metrics:
1. Go to **Reports → Executive Dashboard**
2. View threat trends over time
3. See compliance coverage
4. Export for presentations

### Risk Scoring

Configure risk scoring frameworks:
- CVSS-based scoring
- Custom risk matrices
- Likelihood × Impact calculations

---

## Notifications

Stay informed about important changes:

### Notification Channels

- **In-App** - Badge on notification icon
- **Email** - Daily digest or immediate
- **Slack** - Channel or DM notifications *(Coming Soon)*
- **MS Teams** - Teams channel integration *(Coming Soon)*

### Configuring Notifications

1. Go to **Settings → Notifications**
2. Choose which events to receive
3. Select preferred channels
4. Set quiet hours if needed

### Events You Can Subscribe To

- New threats added to your models
- Mitigations assigned to you
- Review requests and approvals
- Team member changes
- CI/CD scan results

---

## CI/CD Integration

Integrate threat modeling into your development pipeline.

### Setting Up CI/CD

1. Generate an API key in **Settings → API Keys**
2. Add the key to your CI secrets
3. Configure the scan step in your pipeline

### Example GitHub Actions step

Export the model as YAML, commit it, and validate it with the `ftm` CLI
(see [FTM_CLI.md](./FTM_CLI.md)); the step fails when a threat at or above the
threshold is unmitigated.

```yaml
- name: Validate threat model
  run: |
    (cd cli && npm ci && npm run build)
    node cli/dist/cli.js validate threatforge.yaml --fail-on HIGH
```

### PR Comments

When enabled, ThreatForge posts:
- Summary of relevant threats
- New threats since last scan
- Mitigation coverage status

---

## Getting Help

### In-App Help

- Press `?` for keyboard shortcuts
- Hover over icons for contextual tooltips
- Check the notification panel for tips
- First-time users see an onboarding wizard

### Documentation

- Full documentation at `/docs`
- API reference for integrations
- STRIDE methodology guide
- Interactive Swagger docs at `/docs` on the API server

### Support

- Report issues at the GitHub repository
- Contact your organization admin
- Check release notes for new features

---

## Appendix: Risk Scoring

### CVSS Score Interpretation

| Score | Severity | Action |
|-------|----------|--------|
| 9.0-10.0 | Critical | Immediate remediation |
| 7.0-8.9 | High | Priority fix |
| 4.0-6.9 | Medium | Scheduled fix |
| 0.1-3.9 | Low | As resources allow |
| 0.0 | Info | Documentation only |

### Custom Risk Matrices

Create custom scoring:
1. Go to **Settings → Risk Frameworks**
2. Define likelihood and impact scales
3. Map severities to score ranges
4. Apply to new threat assessments
