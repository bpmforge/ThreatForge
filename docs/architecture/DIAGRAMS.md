# Architecture Diagrams

Visual diagrams for ThreatForge architecture using Mermaid.

---

## System Overview

_Updated May 2026 — 6-container deployment, BullMQ async AI jobs._

```mermaid
graph TB
    subgraph Public["Public Zone"]
        Browser[Web Browser]
        CI[CI/CD Agent<br/>Bearer ftm_xxx]
    end

    subgraph Edge["Edge (Cloudflare + nginx)"]
        CF[Cloudflare CDN<br/>WAF/DDoS]
        Nginx[nginx<br/>SSL termination]
    end

    subgraph App["Application Zone (Docker Compose)"]
        subgraph Frontend["frontend container (Next.js :3000)"]
            App[App Router]
            Canvas[React Flow Canvas<br/>Lucid-Lines LL1-LL4]
            Stores[Zustand Stores<br/>6 slices]
            TQ[TanStack Query<br/>+ AI job poller]
        end

        subgraph Backend["server container (Fastify :3001)"]
            API[REST API<br/>79 route modules]
            WS[WebSocket Server<br/>Yjs collab]
            Services[Services Layer<br/>41+ dirs]
            Worker[BullMQ Worker<br/>10 AI job types]
        end

        Backup[backup container<br/>pg_dump cron]
    end

    subgraph Data["Data Zone"]
        DB[(db container<br/>PostgreSQL 17<br/>84 models)]
        Redis[(redis container<br/>:6379<br/>BullMQ + Yjs)]
    end

    subgraph External["External"]
        AI[AI Providers<br/>Claude/OpenAI/Gemini<br/>Vertex/Ollama/LMStudio]
        OAuth[OAuth/SSO<br/>GitHub/Google/Azure/SAML]
        Trackers[Issue Trackers<br/>Jira/GitHub]
    end

    Browser --> CF
    CI --> CF
    CF --> Nginx
    Nginx -->|/| Frontend
    Nginx -->|/api| Backend
    App --> Canvas
    Canvas --> Stores
    TQ --> API
    Canvas --> WS
    API --> Services
    API --> Worker
    WS --> Services
    Worker --> Redis
    Worker --> AI
    Services --> DB
    Services --> Redis
    Services --> Trackers
    App --> OAuth
    Backup --> DB
```

---

## Frontend Components

```mermaid
graph TB
    subgraph Pages["App Routes"]
        Dashboard["/dashboard"]
        Models["/models/[id]"]
        Admin["/admin/*"]
        Auth["/login, /register"]
    end

    subgraph Core["Core Components"]
        TMCanvas[ThreatModelCanvas]
        Sidebar[AppSidebar]
        Toolbar[Toolbar]
        Panels[Properties/Palette Panels]
    end

    subgraph Features["Key Features"]
        Threats[Threats Panel]
        AIChat[AI Chat]
        Export[Export Service]
        Collab[Collaboration]
        DFD[DFD Canvas]
    end

    subgraph State["State Management"]
        CanvasStore[canvas-store]
        UIStore[ui-store]
        HistoryStore[history-store]
    end

    Dashboard --> Sidebar
    Models --> TMCanvas
    TMCanvas --> Toolbar
    TMCanvas --> Panels
    TMCanvas --> Threats
    TMCanvas --> AIChat
    TMCanvas --> Collab

    Threats --> CanvasStore
    TMCanvas --> CanvasStore
    Toolbar --> UIStore
    TMCanvas --> HistoryStore

    Export --> CanvasStore
```

---

## Backend Services

```mermaid
graph TB
    subgraph API["API Layer"]
        ThreatModels[Threat Models API]
        ThreatsAPI[Threats API]
        OrgsAPI[Organizations API]
        AIAPI[AI API]
        AuthAPI[Auth API]
    end

    subgraph Services["Service Layer"]
        AccessControl[Access Control]
        AIService[AI Service]
        Encryption[Encryption]
        Collaboration[Collaboration]
        Audit[Audit Logging]
    end

    subgraph Providers["AI Providers"]
        Claude[Claude]
        OpenAI[OpenAI]
        Gemini[Gemini]
        Ollama[Ollama]
        LMStudio[LM Studio]
    end

    subgraph Data["Data Layer"]
        Prisma[Prisma ORM]
        DB[(PostgreSQL)]
    end

    ThreatModels --> AccessControl
    ThreatsAPI --> AccessControl
    OrgsAPI --> AccessControl
    AIAPI --> AIService
    AuthAPI --> AccessControl

    AccessControl --> Prisma
    AIService --> Providers
    Encryption --> Prisma
    Collaboration --> Prisma
    Audit --> Prisma

    Prisma --> DB
```

---

## Data Model (Core Entities)

```mermaid
erDiagram
    User ||--o{ Membership : has
    Organization ||--o{ Membership : has
    Organization ||--o{ Project : owns
    Project ||--o{ ThreatModel : contains

    ThreatModel ||--o{ Threat : has
    ThreatModel ||--o{ Version : snapshots
    ThreatModel ||--|| CanvasState : stores

    Threat ||--o{ Mitigation : addressed_by
    Threat }o--|| Component : targets

    User {
        string id PK
        string email
        string name
        boolean twoFactorEnabled
    }

    Organization {
        string id PK
        string name
        string slug
        enum type
    }

    ThreatModel {
        string id PK
        string name
        json canvasState
        enum status
    }

    Threat {
        string id PK
        enum category
        string title
        enum severity
        enum status
    }
```

---

## Canvas Load Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant D as Database

    U->>F: Navigate to /models/[id]
    F->>A: GET /api/threat-models/:id
    A->>D: Query ThreatModel
    D-->>A: Model + canvasState JSON
    A-->>F: Response
    F->>F: loadCanvas(nodes, edges)
    F-->>U: Render React Flow
```

---

## Threat Creation Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant C as Canvas
    participant S as Store
    participant A as API
    participant AI as AI Provider

    U->>C: Select component
    U->>C: Click "Add Threat"
    C->>AI: Request suggestions (optional)
    AI-->>C: STRIDE-based threats
    U->>C: Configure threat details
    C->>S: addThreat()
    S->>A: POST /api/threats
    A-->>S: Created threat
    S-->>C: Update UI
    C-->>U: Show threat card
```

---

## Real-Time Collaboration Sequence

```mermaid
sequenceDiagram
    participant A as User A
    participant WS as WebSocket Server
    participant R as Redis
    participant B as User B

    A->>WS: Connect to /ws/model-123
    B->>WS: Connect to /ws/model-123
    WS->>R: Subscribe model-123

    A->>WS: Move node (Yjs update)
    WS->>R: Publish update
    R->>WS: Broadcast to subscribers
    WS->>B: Forward update
    B->>B: Apply to local canvas
```

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant N as NextAuth
    participant A as API
    participant D as Database

    U->>F: Login with credentials
    F->>N: POST /api/auth/signin
    N->>D: Validate credentials
    D-->>N: User record
    N->>N: Create session
    N-->>F: Set session cookie

    F->>A: API request + cookie
    A->>A: Validate session
    A-->>F: Protected data
```

---

## Export Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant S as Canvas Store
    participant E as Export Service

    U->>F: Click Export → PDF
    F->>S: Get current state
    S-->>F: nodes, edges, threats
    F->>E: Generate export
    E->>E: Transform to format
    E-->>F: File blob
    F-->>U: Download file
```

---

## AI Threat Suggestion Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant S as AIService
    participant P as AI Provider

    U->>F: Click "Suggest Threats"
    F->>A: POST /ai/suggest-threats
    A->>A: Sanitize input
    A->>S: suggestThreats(context)
    S->>S: Build STRIDE prompt
    S->>P: Generate completion
    P-->>S: JSON response
    S->>S: Parse threats
    S-->>A: Threat[]
    A-->>F: Suggestions
    F-->>U: Display cards
```

---

## AI Provider Health Check

```mermaid
sequenceDiagram
    participant F as Frontend
    participant A as API
    participant M as ProviderManager
    participant P as Providers

    F->>A: GET /ai/providers/health
    A->>M: checkAllProviders()

    par Parallel health checks
        M->>P: Claude ping
        M->>P: OpenAI ping
        M->>P: Ollama ping
        M->>P: LM Studio ping
    end

    P-->>M: Status responses
    M-->>A: HealthStatus[]
    A-->>F: Provider status
```

---

## Component Types

```mermaid
graph LR
    subgraph Components["Diagram Components"]
        WA[Web App]
        API[API/Service]
        DB[(Database)]
        EXT[External Entity]
        QUEUE[Message Queue]
        CACHE[Cache]
    end

    subgraph Boundaries["Trust Boundaries"]
        INT[Internal]
        DMZ[DMZ]
        EXT_B[External]
    end

    subgraph Connections["Data Flows"]
        HTTPS[HTTPS]
        GRPC[gRPC]
        TCP[TCP]
        AMQP[AMQP]
    end
```

---

## STRIDE Threat Categories

```mermaid
pie title Threat Categories (STRIDE)
    "Spoofing" : 16
    "Tampering" : 18
    "Repudiation" : 12
    "Info Disclosure" : 20
    "Denial of Service" : 15
    "Elevation of Privilege" : 19
```

---

## Prompt Pipeline System

### Pipeline Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend"]
        PromptLib[Prompt Library]
        PipelineBuilder[Pipeline Builder]
        ExecutionViewer[Execution Viewer]
    end

    subgraph Hooks["React Hooks"]
        usePrompts[usePrompts]
        usePipelines[usePipelines]
        useExecution[usePipelineExecution]
    end

    subgraph API["Backend API"]
        PromptAPI["/prompts/*"]
        PipelineAPI["/pipelines/*"]
        ExecuteAPI["/pipelines/:id/execute"]
    end

    subgraph Services["Services"]
        PromptSvc[PromptService]
        PipelineSvc[PipelineService]
    end

    subgraph AI["AI Layer"]
        AIService[AIService]
        Providers[AI Providers]
    end

    subgraph Data["Database"]
        Templates[(PromptTemplate)]
        Pipelines[(Pipeline)]
        Executions[(Execution)]
    end

    PromptLib --> usePrompts --> PromptAPI --> PromptSvc
    PipelineBuilder --> usePipelines --> PipelineAPI --> PipelineSvc
    ExecutionViewer --> useExecution --> ExecuteAPI --> PipelineSvc

    PromptSvc --> Templates
    PipelineSvc --> Pipelines
    PipelineSvc --> Executions
    PipelineSvc --> PromptSvc
    PromptSvc --> AIService --> Providers
```

### Pipeline Execution Flow

```mermaid
sequenceDiagram
    participant U as User
    participant API as Pipeline API
    participant PS as PipelineService
    participant PRS as PromptService
    participant AI as AIService
    participant DB as Database

    U->>API: Execute Pipeline
    API->>PS: executePipeline(input)
    PS->>DB: Create PipelineExecution

    loop Each Stage
        PS->>DB: Create StageExecution
        PS->>PRS: Execute prompt template
        PRS->>AI: Generate completion
        AI-->>PRS: Response
        PRS-->>PS: Parsed output
        PS->>DB: Update StageExecution
        PS->>PS: Map outputs to next stage
    end

    PS->>DB: Update PipelineExecution
    PS-->>API: PipelineExecutionResult
    API-->>U: Execution complete
```

### Prompt Template Flow

```mermaid
flowchart LR
    subgraph Input
        Doc[Document]
        Vars[Variables]
    end

    subgraph Template["Prompt Template"]
        Sys[System Prompt]
        User["User Template\n{{variables}}"]
    end

    subgraph Processing
        Interp[Variable\nInterpolation]
        AI[AI Provider]
        Parse[Output\nParsing]
    end

    subgraph Output
        Result[Structured\nResult]
        Log[Execution\nLog]
    end

    Doc --> Interp
    Vars --> Interp
    Sys --> AI
    Interp --> User --> AI
    AI --> Parse
    Parse --> Result
    Parse --> Log
```

### Document Type Detection

```mermaid
flowchart TB
    Doc[Input Document] --> Detect{Document\nDetector}

    Detect --> Rule1[Check Keywords]
    Detect --> Rule2[Check Patterns]
    Detect --> Rule3[Check Extension]

    Rule1 --> Score[Calculate\nScore]
    Rule2 --> Score
    Rule3 --> Score

    Score --> Threshold{Above\nThreshold?}

    Threshold -->|Yes| Match[Matched\nDocument Type]
    Threshold -->|No| Default[Default\nType]

    Match --> Prompt[Select\nPrompt Template]
    Default --> Prompt

    Prompt --> Execute[Execute\nPrompt]
```

---

*Diagrams render in GitHub, VS Code (with Mermaid extension), and most Markdown viewers.*
