/**
 * Pre-Built Architecture Templates
 *
 * Seed data for 5 starter templates. Each includes:
 * - Pre-placed components with positions
 * - Connections with protocol/encryption metadata
 * - Trust boundaries
 * - Pre-identified STRIDE threats per component
 * - Suggested mitigations
 *
 * Run: npx tsx prisma/seed/templates.ts
 */

interface TemplateComponent {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number };
  trustLevel?: "INTERNAL" | "EXTERNAL" | "DMZ";
  description?: string;
}

interface TemplateConnection {
  id: string;
  source: string;
  target: string;
  label?: string;
  protocol?: string;
  encrypted?: boolean;
  authMethod?: string;
}

interface TemplateBoundary {
  id: string;
  name: string;
  componentIds: string[];
}

interface TemplateThreat {
  name: string;
  description: string;
  strideCategory: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  componentId: string;
  mitigation?: string;
}

export interface Template {
  name: string;
  description: string;
  tags: string[];
  components: TemplateComponent[];
  connections: TemplateConnection[];
  boundaries: TemplateBoundary[];
  threats: TemplateThreat[];
}

// =============================================================================
// Template 1: Standard Web Application
// =============================================================================

const webAppTemplate: Template = {
  name: "Standard Web Application",
  description:
    "React/Next.js frontend + REST API + PostgreSQL database with authentication and CDN. Common pattern for SaaS applications.",
  tags: ["web", "saas", "react", "api", "postgresql"],
  components: [
    {
      id: "user",
      name: "End User",
      type: "EXTERNAL_USER",
      position: { x: 100, y: 300 },
      trustLevel: "EXTERNAL",
    },
    {
      id: "cdn",
      name: "CDN",
      type: "CDN",
      position: { x: 300, y: 100 },
      trustLevel: "DMZ",
      description: "Static asset delivery + DDoS protection",
    },
    {
      id: "frontend",
      name: "Web Frontend",
      type: "WEB_APP",
      position: { x: 300, y: 300 },
      trustLevel: "DMZ",
      description: "React/Next.js SPA",
    },
    {
      id: "api",
      name: "API Server",
      type: "API",
      position: { x: 550, y: 300 },
      trustLevel: "INTERNAL",
      description: "REST API with JWT authentication",
    },
    {
      id: "auth",
      name: "Auth Service",
      type: "AUTH_SERVICE",
      position: { x: 550, y: 100 },
      trustLevel: "INTERNAL",
      description: "JWT issuance, OAuth2, session management",
    },
    {
      id: "db",
      name: "PostgreSQL",
      type: "DATABASE",
      position: { x: 800, y: 300 },
      trustLevel: "INTERNAL",
      description: "Primary data store",
    },
    {
      id: "cache",
      name: "Redis Cache",
      type: "CACHE",
      position: { x: 800, y: 100 },
      trustLevel: "INTERNAL",
      description: "Session cache + rate limiting",
    },
    {
      id: "email",
      name: "Email Service",
      type: "EXTERNAL_USER",
      position: { x: 800, y: 500 },
      trustLevel: "EXTERNAL",
      description: "SendGrid/SES for transactional email",
    },
  ],
  connections: [
    {
      id: "e1",
      source: "user",
      target: "cdn",
      label: "Static Assets",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "e2",
      source: "user",
      target: "frontend",
      label: "Web Traffic",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "e3",
      source: "frontend",
      target: "api",
      label: "API Calls",
      protocol: "HTTPS",
      encrypted: true,
      authMethod: "JWT",
    },
    {
      id: "e4",
      source: "api",
      target: "auth",
      label: "Auth Verification",
      protocol: "HTTP",
      encrypted: false,
      authMethod: "INTERNAL",
    },
    {
      id: "e5",
      source: "api",
      target: "db",
      label: "Data Access",
      protocol: "TCP",
      encrypted: true,
      authMethod: "PASSWORD",
    },
    {
      id: "e6",
      source: "api",
      target: "cache",
      label: "Cache Read/Write",
      protocol: "TCP",
      encrypted: false,
    },
    {
      id: "e7",
      source: "api",
      target: "email",
      label: "Send Email",
      protocol: "HTTPS",
      encrypted: true,
      authMethod: "API_KEY",
    },
  ],
  boundaries: [
    { id: "b1", name: "Public Internet", componentIds: ["user"] },
    { id: "b2", name: "DMZ", componentIds: ["cdn", "frontend"] },
    {
      id: "b3",
      name: "Internal Network",
      componentIds: ["api", "auth", "db", "cache"],
    },
  ],
  threats: [
    {
      name: "XSS via user input",
      description:
        "Attacker injects JavaScript through input fields rendered in the frontend",
      strideCategory: "TAMPERING",
      severity: "HIGH",
      componentId: "frontend",
      mitigation:
        "Sanitize all user input, use CSP headers, escape HTML output",
    },
    {
      name: "SQL injection",
      description: "Attacker crafts SQL through API parameters",
      strideCategory: "TAMPERING",
      severity: "CRITICAL",
      componentId: "api",
      mitigation:
        "Use parameterized queries (ORM), validate all input with Zod/Joi",
    },
    {
      name: "JWT token theft",
      description: "Stolen JWT allows impersonation of any user",
      strideCategory: "SPOOFING",
      severity: "HIGH",
      componentId: "auth",
      mitigation:
        "Short-lived access tokens (15min), httpOnly cookies, token rotation",
    },
    {
      name: "Brute force login",
      description: "Attacker tries many passwords to guess credentials",
      strideCategory: "SPOOFING",
      severity: "MEDIUM",
      componentId: "auth",
      mitigation: "Rate limiting on login endpoint, account lockout, MFA",
    },
    {
      name: "Database credential exposure",
      description: "Connection string with password leaked in logs or config",
      strideCategory: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentId: "db",
      mitigation:
        "Use environment variables, rotate credentials, encrypt at rest",
    },
    {
      name: "Session fixation",
      description: "Attacker forces a known session ID before authentication",
      strideCategory: "ELEVATION_OF_PRIVILEGE",
      severity: "MEDIUM",
      componentId: "cache",
      mitigation: "Regenerate session ID after login, validate session binding",
    },
    {
      name: "Email header injection",
      description: "Attacker injects headers to send spam via the app",
      strideCategory: "TAMPERING",
      severity: "MEDIUM",
      componentId: "email",
      mitigation: "Validate email addresses, sanitize subject/body fields",
    },
    {
      name: "DDoS on API",
      description: "Flood of requests overwhelms the API server",
      strideCategory: "DENIAL_OF_SERVICE",
      severity: "HIGH",
      componentId: "api",
      mitigation: "CDN-level DDoS protection, API rate limiting, auto-scaling",
    },
    {
      name: "Missing audit trail",
      description: "No logging of who accessed or modified sensitive data",
      strideCategory: "REPUDIATION",
      severity: "MEDIUM",
      componentId: "api",
      mitigation:
        "Structured audit logging for all write operations, immutable log storage",
    },
  ],
};

// =============================================================================
// Template 2: Microservices on Kubernetes
// =============================================================================

const microservicesTemplate: Template = {
  name: "Microservices on Kubernetes",
  description:
    "API Gateway + 3 services + database per service + message queue. Deployed on Kubernetes with service mesh.",
  tags: ["microservices", "kubernetes", "api-gateway", "event-driven"],
  components: [
    {
      id: "user",
      name: "Client",
      type: "EXTERNAL_USER",
      position: { x: 100, y: 300 },
      trustLevel: "EXTERNAL",
    },
    {
      id: "gateway",
      name: "API Gateway",
      type: "API_GATEWAY",
      position: { x: 300, y: 300 },
      trustLevel: "DMZ",
      description: "Kong/Envoy — routing, auth, rate limiting",
    },
    {
      id: "user-svc",
      name: "User Service",
      type: "MICROSERVICE",
      position: { x: 550, y: 100 },
      trustLevel: "INTERNAL",
      description: "User management, profiles, preferences",
    },
    {
      id: "order-svc",
      name: "Order Service",
      type: "MICROSERVICE",
      position: { x: 550, y: 300 },
      trustLevel: "INTERNAL",
      description: "Order processing, payment orchestration",
    },
    {
      id: "notify-svc",
      name: "Notification Service",
      type: "MICROSERVICE",
      position: { x: 550, y: 500 },
      trustLevel: "INTERNAL",
      description: "Email, SMS, push notifications",
    },
    {
      id: "user-db",
      name: "User DB",
      type: "DATABASE",
      position: { x: 800, y: 100 },
      trustLevel: "INTERNAL",
    },
    {
      id: "order-db",
      name: "Order DB",
      type: "DATABASE",
      position: { x: 800, y: 300 },
      trustLevel: "INTERNAL",
    },
    {
      id: "queue",
      name: "Message Queue",
      type: "QUEUE",
      position: { x: 800, y: 500 },
      trustLevel: "INTERNAL",
      description: "RabbitMQ/Kafka for async events",
    },
    {
      id: "k8s",
      name: "Kubernetes",
      type: "KUBERNETES",
      position: { x: 550, y: 700 },
      trustLevel: "INTERNAL",
      description: "Container orchestration + service mesh",
    },
  ],
  connections: [
    {
      id: "e1",
      source: "user",
      target: "gateway",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "e2",
      source: "gateway",
      target: "user-svc",
      protocol: "gRPC",
      encrypted: true,
      authMethod: "mTLS",
    },
    {
      id: "e3",
      source: "gateway",
      target: "order-svc",
      protocol: "gRPC",
      encrypted: true,
      authMethod: "mTLS",
    },
    {
      id: "e4",
      source: "user-svc",
      target: "user-db",
      protocol: "TCP",
      encrypted: true,
    },
    {
      id: "e5",
      source: "order-svc",
      target: "order-db",
      protocol: "TCP",
      encrypted: true,
    },
    {
      id: "e6",
      source: "order-svc",
      target: "queue",
      label: "Order Events",
      protocol: "AMQP",
      encrypted: true,
    },
    {
      id: "e7",
      source: "queue",
      target: "notify-svc",
      label: "Consume Events",
      protocol: "AMQP",
      encrypted: true,
    },
  ],
  boundaries: [
    { id: "b1", name: "External", componentIds: ["user"] },
    { id: "b2", name: "DMZ", componentIds: ["gateway"] },
    {
      id: "b3",
      name: "K8s Cluster",
      componentIds: [
        "user-svc",
        "order-svc",
        "notify-svc",
        "user-db",
        "order-db",
        "queue",
        "k8s",
      ],
    },
  ],
  threats: [
    {
      name: "API Gateway bypass",
      description:
        "Attacker accesses internal services directly, bypassing gateway auth",
      strideCategory: "ELEVATION_OF_PRIVILEGE",
      severity: "CRITICAL",
      componentId: "gateway",
      mitigation:
        "Network policies restrict inter-service traffic to gateway only, mTLS between all services",
    },
    {
      name: "Service impersonation",
      description:
        "Compromised service sends requests pretending to be another service",
      strideCategory: "SPOOFING",
      severity: "HIGH",
      componentId: "order-svc",
      mitigation:
        "mTLS with certificate pinning, service identity verification",
    },
    {
      name: "Message queue poisoning",
      description:
        "Malicious messages injected into queue cause downstream failures",
      strideCategory: "TAMPERING",
      severity: "HIGH",
      componentId: "queue",
      mitigation:
        "Message signing, schema validation on consume, dead letter queue",
    },
    {
      name: "Cross-service data leak",
      description: "One service accesses another services database directly",
      strideCategory: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentId: "user-db",
      mitigation:
        "Database per service, network isolation, no shared DB access",
    },
    {
      name: "Container escape",
      description:
        "Attacker breaks out of container to access host or other pods",
      strideCategory: "ELEVATION_OF_PRIVILEGE",
      severity: "CRITICAL",
      componentId: "k8s",
      mitigation:
        "Pod security policies, non-root containers, seccomp profiles, read-only filesystem",
    },
    {
      name: "Cascading failure",
      description: "One service failure cascades to take down all services",
      strideCategory: "DENIAL_OF_SERVICE",
      severity: "HIGH",
      componentId: "order-svc",
      mitigation:
        "Circuit breakers, bulkheads, health checks, graceful degradation",
    },
  ],
};

// =============================================================================
// Template 3: Serverless AWS
// =============================================================================

const serverlessTemplate: Template = {
  name: "Serverless AWS",
  description:
    "API Gateway + Lambda + DynamoDB + Cognito + S3 + CloudWatch. Pay-per-use, auto-scaling serverless architecture.",
  tags: ["aws", "serverless", "lambda", "dynamodb", "cognito"],
  components: [
    {
      id: "user",
      name: "Client",
      type: "EXTERNAL_USER",
      position: { x: 100, y: 300 },
      trustLevel: "EXTERNAL",
    },
    {
      id: "apigw",
      name: "API Gateway",
      type: "API_GATEWAY",
      position: { x: 300, y: 300 },
      trustLevel: "DMZ",
      description: "AWS API Gateway with WAF",
    },
    {
      id: "cognito",
      name: "Cognito",
      type: "AUTH_SERVICE",
      position: { x: 300, y: 100 },
      trustLevel: "INTERNAL",
      description: "User pools, OAuth2, MFA",
    },
    {
      id: "lambda-api",
      name: "API Lambda",
      type: "SERVERLESS",
      position: { x: 550, y: 300 },
      trustLevel: "INTERNAL",
      description: "Business logic functions",
    },
    {
      id: "lambda-worker",
      name: "Worker Lambda",
      type: "SERVERLESS",
      position: { x: 550, y: 500 },
      trustLevel: "INTERNAL",
      description: "Async event processing",
    },
    {
      id: "dynamo",
      name: "DynamoDB",
      type: "DATABASE",
      position: { x: 800, y: 300 },
      trustLevel: "INTERNAL",
      description: "NoSQL data store with encryption at rest",
    },
    {
      id: "s3",
      name: "S3 Bucket",
      type: "OBJECT_STORAGE",
      position: { x: 800, y: 100 },
      trustLevel: "INTERNAL",
      description: "File storage with versioning",
    },
    {
      id: "sqs",
      name: "SQS Queue",
      type: "QUEUE",
      position: { x: 800, y: 500 },
      trustLevel: "INTERNAL",
      description: "Async message processing",
    },
    {
      id: "cloudwatch",
      name: "CloudWatch",
      type: "MONITORING",
      position: { x: 550, y: 700 },
      trustLevel: "INTERNAL",
      description: "Logging, metrics, alarms",
    },
  ],
  connections: [
    {
      id: "e1",
      source: "user",
      target: "apigw",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "e2",
      source: "user",
      target: "cognito",
      label: "Auth Flow",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "e3",
      source: "apigw",
      target: "lambda-api",
      label: "Invoke",
      protocol: "HTTPS",
      encrypted: true,
      authMethod: "IAM",
    },
    {
      id: "e4",
      source: "lambda-api",
      target: "dynamo",
      protocol: "HTTPS",
      encrypted: true,
      authMethod: "IAM",
    },
    {
      id: "e5",
      source: "lambda-api",
      target: "s3",
      label: "File Operations",
      protocol: "HTTPS",
      encrypted: true,
      authMethod: "IAM",
    },
    {
      id: "e6",
      source: "lambda-api",
      target: "sqs",
      label: "Enqueue",
      protocol: "HTTPS",
      encrypted: true,
      authMethod: "IAM",
    },
    {
      id: "e7",
      source: "sqs",
      target: "lambda-worker",
      label: "Trigger",
      protocol: "HTTPS",
      encrypted: true,
    },
  ],
  boundaries: [
    { id: "b1", name: "Internet", componentIds: ["user"] },
    {
      id: "b2",
      name: "AWS VPC",
      componentIds: [
        "apigw",
        "cognito",
        "lambda-api",
        "lambda-worker",
        "dynamo",
        "s3",
        "sqs",
        "cloudwatch",
      ],
    },
  ],
  threats: [
    {
      name: "IAM over-permission",
      description:
        "Lambda roles have broader permissions than needed (admin access)",
      strideCategory: "ELEVATION_OF_PRIVILEGE",
      severity: "HIGH",
      componentId: "lambda-api",
      mitigation:
        "Least-privilege IAM policies per function, no wildcard resources",
    },
    {
      name: "S3 bucket misconfiguration",
      description: "Public bucket exposes sensitive files to internet",
      strideCategory: "INFORMATION_DISCLOSURE",
      severity: "CRITICAL",
      componentId: "s3",
      mitigation:
        "Block public access, bucket policies, encryption at rest, access logging",
    },
    {
      name: "Lambda cold start exploitation",
      description:
        "Attacker times requests to exploit initialization vulnerabilities",
      strideCategory: "TAMPERING",
      severity: "LOW",
      componentId: "lambda-api",
      mitigation:
        "Provisioned concurrency for sensitive functions, input validation before any processing",
    },
    {
      name: "DynamoDB injection",
      description:
        "Malicious input in query conditions leads to data exfiltration",
      strideCategory: "TAMPERING",
      severity: "HIGH",
      componentId: "dynamo",
      mitigation:
        "Use ExpressionAttributeValues (parameterized), validate all input",
    },
    {
      name: "API Gateway rate limit bypass",
      description: "Attacker uses distributed requests to exceed rate limits",
      strideCategory: "DENIAL_OF_SERVICE",
      severity: "MEDIUM",
      componentId: "apigw",
      mitigation: "WAF rules, per-API-key throttling, CloudFront caching",
    },
    {
      name: "Cognito account takeover",
      description:
        "Weak password policy or missing MFA allows credential stuffing",
      strideCategory: "SPOOFING",
      severity: "HIGH",
      componentId: "cognito",
      mitigation:
        "Strong password policy, mandatory MFA, compromised credential detection",
    },
  ],
};

// =============================================================================
// Template 4: Mobile App + Backend
// =============================================================================

const mobileTemplate: Template = {
  name: "Mobile App + Backend API",
  description:
    "iOS/Android app communicating with REST API. Includes push notifications, offline sync, and OAuth2 authentication.",
  tags: ["mobile", "ios", "android", "api", "push-notifications"],
  components: [
    {
      id: "mobile",
      name: "Mobile App",
      type: "MOBILE_APP",
      position: { x: 100, y: 300 },
      trustLevel: "EXTERNAL",
      description: "iOS/Android native or React Native",
    },
    {
      id: "api",
      name: "Backend API",
      type: "API",
      position: { x: 400, y: 300 },
      trustLevel: "INTERNAL",
      description: "REST API with OAuth2",
    },
    {
      id: "auth",
      name: "Auth Provider",
      type: "AUTH_SERVICE",
      position: { x: 400, y: 100 },
      trustLevel: "INTERNAL",
      description: "OAuth2 + biometric token binding",
    },
    {
      id: "db",
      name: "Database",
      type: "DATABASE",
      position: { x: 700, y: 300 },
      trustLevel: "INTERNAL",
    },
    {
      id: "push",
      name: "Push Service",
      type: "EXTERNAL_USER",
      position: { x: 1000, y: 100 },
      trustLevel: "EXTERNAL",
      description: "FCM/APNs for push notifications",
    },
    {
      id: "storage",
      name: "File Storage",
      type: "OBJECT_STORAGE",
      position: { x: 700, y: 500 },
      trustLevel: "INTERNAL",
      description: "User uploads, media files",
    },
  ],
  connections: [
    {
      id: "e1",
      source: "mobile",
      target: "api",
      protocol: "HTTPS",
      encrypted: true,
      authMethod: "OAuth2",
    },
    {
      id: "e2",
      source: "mobile",
      target: "auth",
      label: "OAuth2 Flow",
      protocol: "HTTPS",
      encrypted: true,
    },
    { id: "e3", source: "api", target: "db", protocol: "TCP", encrypted: true },
    {
      id: "e4",
      source: "api",
      target: "push",
      label: "Send Notification",
      protocol: "HTTPS",
      encrypted: true,
      authMethod: "API_KEY",
    },
    {
      id: "e5",
      source: "api",
      target: "storage",
      label: "File Upload/Download",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "e6",
      source: "push",
      target: "mobile",
      label: "Push Notification",
      protocol: "HTTPS",
      encrypted: true,
    },
  ],
  boundaries: [
    { id: "b1", name: "User Device", componentIds: ["mobile"] },
    {
      id: "b2",
      name: "Backend",
      componentIds: ["api", "auth", "db", "storage"],
    },
    { id: "b3", name: "Third Party", componentIds: ["push"] },
  ],
  threats: [
    {
      name: "Insecure local storage",
      description: "Sensitive data (tokens, PII) stored unencrypted on device",
      strideCategory: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentId: "mobile",
      mitigation:
        "Use Keychain (iOS) / Keystore (Android) for secrets, encrypt local DB",
    },
    {
      name: "Certificate pinning bypass",
      description: "Attacker intercepts HTTPS traffic with proxy",
      strideCategory: "TAMPERING",
      severity: "HIGH",
      componentId: "mobile",
      mitigation: "Certificate pinning, detect jailbreak/root, TLS 1.3",
    },
    {
      name: "API key extraction from APK",
      description: "Attacker decompiles app to extract hardcoded keys",
      strideCategory: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentId: "mobile",
      mitigation:
        "No secrets in client code, use server-side key management, code obfuscation",
    },
    {
      name: "Push notification spoofing",
      description: "Fake push notifications trick users into actions",
      strideCategory: "SPOOFING",
      severity: "MEDIUM",
      componentId: "push",
      mitigation:
        "Validate push payload signatures, verify notification source in app",
    },
    {
      name: "Offline data tampering",
      description: "User modifies locally cached data before sync",
      strideCategory: "TAMPERING",
      severity: "MEDIUM",
      componentId: "mobile",
      mitigation:
        "Server-side validation on all synced data, conflict resolution, integrity checks",
    },
    {
      name: "OAuth token leak via deep link",
      description: "OAuth redirect intercepted by malicious app via deep link",
      strideCategory: "SPOOFING",
      severity: "HIGH",
      componentId: "auth",
      mitigation:
        "Use PKCE (Proof Key for Code Exchange), app-specific URI schemes with verification",
    },
  ],
};

// =============================================================================
// Template 5: SaaS Multi-Tenant
// =============================================================================

const saasTemplate: Template = {
  name: "SaaS Multi-Tenant Platform",
  description:
    "Multi-tenant SaaS with shared infrastructure, tenant isolation, billing, and admin console. Common for B2B products.",
  tags: ["saas", "multi-tenant", "b2b", "billing", "admin"],
  components: [
    {
      id: "tenant-user",
      name: "Tenant User",
      type: "EXTERNAL_USER",
      position: { x: 100, y: 200 },
      trustLevel: "EXTERNAL",
    },
    {
      id: "admin",
      name: "Platform Admin",
      type: "EXTERNAL_USER",
      position: { x: 100, y: 500 },
      trustLevel: "EXTERNAL",
    },
    {
      id: "lb",
      name: "Load Balancer",
      type: "LOAD_BALANCER",
      position: { x: 300, y: 350 },
      trustLevel: "DMZ",
    },
    {
      id: "webapp",
      name: "Web Application",
      type: "WEB_APP",
      position: { x: 500, y: 200 },
      trustLevel: "INTERNAL",
      description: "Tenant-facing SPA with subdomain routing",
    },
    {
      id: "admin-console",
      name: "Admin Console",
      type: "WEB_APP",
      position: { x: 500, y: 500 },
      trustLevel: "INTERNAL",
      description: "Platform management UI",
    },
    {
      id: "api",
      name: "API Server",
      type: "API",
      position: { x: 700, y: 350 },
      trustLevel: "INTERNAL",
      description: "Multi-tenant API with row-level security",
    },
    {
      id: "db",
      name: "Shared Database",
      type: "DATABASE",
      position: { x: 900, y: 200 },
      trustLevel: "INTERNAL",
      description: "PostgreSQL with tenant_id on every table",
    },
    {
      id: "billing",
      name: "Billing Service",
      type: "EXTERNAL_USER",
      position: { x: 1140, y: 500 },
      trustLevel: "EXTERNAL",
      description: "Stripe/Paddle for subscriptions",
    },
    {
      id: "auth",
      name: "Auth + SSO",
      type: "AUTH_SERVICE",
      position: { x: 700, y: 100 },
      trustLevel: "INTERNAL",
      description: "Multi-tenant auth with SAML/OIDC SSO",
    },
  ],
  connections: [
    {
      id: "e1",
      source: "tenant-user",
      target: "lb",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "e2",
      source: "admin",
      target: "lb",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "e3",
      source: "lb",
      target: "webapp",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "e4",
      source: "lb",
      target: "admin-console",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "e5",
      source: "webapp",
      target: "api",
      protocol: "HTTPS",
      encrypted: true,
      authMethod: "JWT",
    },
    {
      id: "e6",
      source: "admin-console",
      target: "api",
      protocol: "HTTPS",
      encrypted: true,
      authMethod: "JWT",
    },
    { id: "e7", source: "api", target: "db", protocol: "TCP", encrypted: true },
    {
      id: "e8",
      source: "api",
      target: "billing",
      label: "Subscription API",
      protocol: "HTTPS",
      encrypted: true,
      authMethod: "API_KEY",
    },
    {
      id: "e9",
      source: "api",
      target: "auth",
      label: "SSO Verification",
      protocol: "HTTPS",
      encrypted: true,
    },
  ],
  boundaries: [
    { id: "b1", name: "Internet", componentIds: ["tenant-user", "admin"] },
    {
      id: "b2",
      name: "Platform",
      componentIds: ["lb", "webapp", "admin-console", "api", "auth", "db"],
    },
    { id: "b3", name: "Third Party", componentIds: ["billing"] },
  ],
  threats: [
    {
      name: "Tenant data isolation breach",
      description:
        "One tenant accesses another tenants data via missing WHERE tenant_id filter",
      strideCategory: "INFORMATION_DISCLOSURE",
      severity: "CRITICAL",
      componentId: "db",
      mitigation:
        "Row-level security (RLS) in PostgreSQL, tenant_id enforced at ORM/middleware level, automated testing for isolation",
    },
    {
      name: "Tenant impersonation via subdomain",
      description:
        "Attacker accesses tenant subdomain and guesses tenant context",
      strideCategory: "SPOOFING",
      severity: "HIGH",
      componentId: "webapp",
      mitigation:
        "Validate tenant context from auth token (not URL), strict subdomain → tenant_id mapping",
    },
    {
      name: "Privilege escalation to platform admin",
      description: "Tenant admin exploits API to gain platform-level access",
      strideCategory: "ELEVATION_OF_PRIVILEGE",
      severity: "CRITICAL",
      componentId: "api",
      mitigation:
        "Separate admin API routes, explicit role checks, admin actions require MFA",
    },
    {
      name: "Billing webhook manipulation",
      description: "Attacker forges Stripe webhook to grant free access",
      strideCategory: "TAMPERING",
      severity: "HIGH",
      componentId: "billing",
      mitigation:
        "Verify webhook signatures, idempotency keys, reconcile billing state",
    },
    {
      name: "SSO misconfiguration",
      description: "Misconfigured SAML allows authentication bypass",
      strideCategory: "SPOOFING",
      severity: "HIGH",
      componentId: "auth",
      mitigation:
        "Validate SAML assertions fully (signature, audience, timestamps), use established libraries",
    },
    {
      name: "Noisy neighbor DoS",
      description:
        "One tenant uses excessive resources affecting other tenants",
      strideCategory: "DENIAL_OF_SERVICE",
      severity: "MEDIUM",
      componentId: "api",
      mitigation:
        "Per-tenant rate limits, resource quotas, connection pooling per tenant",
    },
    {
      name: "Admin console exposed",
      description:
        "Admin console accessible from public internet without additional protection",
      strideCategory: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentId: "admin-console",
      mitigation:
        "IP allowlist for admin, VPN requirement, separate domain, MFA mandatory",
    },
  ],
};

// =============================================================================
// Template 6: Data Pipeline
// =============================================================================

const dataPipelineTemplate: Template = {
  name: "Data Pipeline",
  description:
    "Batch/streaming data pipeline with ingestion, transformation, storage, and analytics.",
  tags: ["data", "pipeline", "etl", "analytics", "streaming"],
  components: [
    {
      id: "dp-source",
      name: "Data Source",
      type: "EXTERNAL_ENTITY",
      position: { x: 80, y: 200 },
    },
    {
      id: "dp-ingest",
      name: "Ingestion Service",
      type: "PROCESS",
      position: { x: 280, y: 200 },
    },
    {
      id: "dp-queue",
      name: "Message Queue",
      type: "QUEUE",
      position: { x: 480, y: 200 },
    },
    {
      id: "dp-transform",
      name: "Transform Worker",
      type: "PROCESS",
      position: { x: 680, y: 200 },
    },
    {
      id: "dp-lake",
      name: "Data Lake",
      type: "DATA_STORE",
      position: { x: 680, y: 360 },
    },
    {
      id: "dp-warehouse",
      name: "Data Warehouse",
      type: "DATA_STORE",
      position: { x: 880, y: 360 },
    },
    {
      id: "dp-analytics",
      name: "Analytics Dashboard",
      type: "WEB_APP",
      position: { x: 1080, y: 200 },
    },
    {
      id: "dp-scheduler",
      name: "Scheduler",
      type: "PROCESS",
      position: { x: 680, y: 40 },
    },
  ],
  connections: [
    {
      id: "c1",
      source: "dp-source",
      target: "dp-ingest",
      label: "raw data",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "c2",
      source: "dp-ingest",
      target: "dp-queue",
      label: "publish events",
      protocol: "AMQP",
      encrypted: true,
    },
    {
      id: "c3",
      source: "dp-queue",
      target: "dp-transform",
      label: "consume",
      protocol: "AMQP",
      encrypted: true,
    },
    {
      id: "c4",
      source: "dp-transform",
      target: "dp-lake",
      label: "store raw",
      protocol: "internal",
    },
    {
      id: "c5",
      source: "dp-transform",
      target: "dp-warehouse",
      label: "load processed",
      protocol: "internal",
    },
    {
      id: "c6",
      source: "dp-warehouse",
      target: "dp-analytics",
      label: "query",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "c7",
      source: "dp-scheduler",
      target: "dp-transform",
      label: "trigger batch",
    },
  ],
  boundaries: [
    { id: "b1", name: "External Sources", componentIds: ["dp-source"] },
    {
      id: "b2",
      name: "Ingestion Layer",
      componentIds: ["dp-ingest", "dp-queue"],
    },
    {
      id: "b3",
      name: "Processing Layer",
      componentIds: ["dp-transform", "dp-scheduler"],
    },
    {
      id: "b4",
      name: "Storage Layer",
      componentIds: ["dp-lake", "dp-warehouse"],
    },
  ],
  threats: [
    {
      name: "Data poisoning via malicious source",
      description:
        "Attacker injects malformed or malicious records into the ingestion endpoint to corrupt downstream analytics or ML models.",
      strideCategory: "TAMPERING",
      severity: "HIGH",
      componentId: "dp-ingest",
      mitigation:
        "Validate schema and statistical bounds at ingestion; reject outliers; checksum records",
    },
    {
      name: "Unauthorized data access in data lake",
      description:
        "Overly permissive IAM policies allow unauthorized principals to read sensitive data from the data lake.",
      strideCategory: "INFORMATION_DISCLOSURE",
      severity: "CRITICAL",
      componentId: "dp-lake",
      mitigation:
        "Apply column-level and row-level security; encrypt at rest with customer-managed keys; audit access logs",
    },
    {
      name: "Queue message replay attack",
      description:
        "Attacker captures and replays messages in the queue, causing duplicate processing or state corruption.",
      strideCategory: "SPOOFING",
      severity: "MEDIUM",
      componentId: "dp-queue",
      mitigation:
        "Implement idempotency keys; deduplicate on consumer side; use message expiry",
    },
    {
      name: "Scheduler injection",
      description:
        "Attacker with access to scheduler configuration can inject arbitrary job definitions to exfiltrate data or cause resource exhaustion.",
      strideCategory: "ELEVATION_OF_PRIVILEGE",
      severity: "HIGH",
      componentId: "dp-scheduler",
      mitigation:
        "Restrict scheduler configuration to admins; validate job definitions against allowlist; log all schedule changes",
    },
  ],
};

// =============================================================================
// Template 7: IoT Edge
// =============================================================================

const iotEdgeTemplate: Template = {
  name: "IoT Edge",
  description:
    "IoT edge architecture with devices, gateway, MQTT broker, cloud API, and device management.",
  tags: ["iot", "edge", "mqtt", "embedded", "devices"],
  components: [
    {
      id: "iot-device",
      name: "IoT Device",
      type: "EXTERNAL_ENTITY",
      position: { x: 80, y: 240 },
      trustLevel: "EXTERNAL",
    },
    {
      id: "iot-gateway",
      name: "Edge Gateway",
      type: "PROCESS",
      position: { x: 300, y: 240 },
      trustLevel: "DMZ",
    },
    {
      id: "iot-broker",
      name: "MQTT Broker",
      type: "QUEUE",
      position: { x: 520, y: 240 },
      trustLevel: "INTERNAL",
    },
    {
      id: "iot-api",
      name: "Cloud API",
      type: "API",
      position: { x: 740, y: 240 },
      trustLevel: "INTERNAL",
    },
    {
      id: "iot-db",
      name: "Time-Series DB",
      type: "DATA_STORE",
      position: { x: 740, y: 400 },
      trustLevel: "INTERNAL",
    },
    {
      id: "iot-mgmt",
      name: "Device Management",
      type: "PROCESS",
      position: { x: 960, y: 240 },
      trustLevel: "INTERNAL",
    },
    {
      id: "iot-dashboard",
      name: "Operations Dashboard",
      type: "WEB_APP",
      position: { x: 1160, y: 240 },
    },
    {
      id: "iot-fwupdate",
      name: "Firmware Update Server",
      type: "PROCESS",
      position: { x: 960, y: 400 },
      trustLevel: "INTERNAL",
    },
  ],
  connections: [
    {
      id: "c1",
      source: "iot-device",
      target: "iot-gateway",
      label: "telemetry",
      protocol: "MQTT/TLS",
      encrypted: true,
    },
    {
      id: "c2",
      source: "iot-gateway",
      target: "iot-broker",
      label: "forward events",
      protocol: "MQTT",
      encrypted: true,
    },
    {
      id: "c3",
      source: "iot-broker",
      target: "iot-api",
      label: "process events",
      protocol: "internal",
    },
    {
      id: "c4",
      source: "iot-api",
      target: "iot-db",
      label: "persist telemetry",
    },
    {
      id: "c5",
      source: "iot-api",
      target: "iot-mgmt",
      label: "device commands",
    },
    {
      id: "c6",
      source: "iot-mgmt",
      target: "iot-dashboard",
      label: "device status",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "c7",
      source: "iot-fwupdate",
      target: "iot-device",
      label: "OTA update",
      protocol: "HTTPS",
      encrypted: true,
    },
  ],
  boundaries: [
    { id: "b1", name: "Field / Untrusted", componentIds: ["iot-device"] },
    { id: "b2", name: "Edge Layer", componentIds: ["iot-gateway"] },
    {
      id: "b3",
      name: "Cloud Backend",
      componentIds: [
        "iot-broker",
        "iot-api",
        "iot-db",
        "iot-mgmt",
        "iot-fwupdate",
      ],
    },
  ],
  threats: [
    {
      name: "Device spoofing / impersonation",
      description:
        "Attacker clones a device identity or uses stolen credentials to publish false telemetry or receive commands.",
      strideCategory: "SPOOFING",
      severity: "CRITICAL",
      componentId: "iot-device",
      mitigation:
        "Use per-device X.509 certificates; mutual TLS; certificate pinning on device",
    },
    {
      name: "Firmware tampering / malicious OTA",
      description:
        "Attacker intercepts or replaces firmware update package to install malicious firmware on devices.",
      strideCategory: "TAMPERING",
      severity: "CRITICAL",
      componentId: "iot-fwupdate",
      mitigation:
        "Sign firmware packages; verify signature on device before flashing; use secure boot",
    },
    {
      name: "MQTT broker unauthenticated access",
      description:
        "Misconfigured MQTT broker allows anonymous subscriptions, leaking device telemetry to any client.",
      strideCategory: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentId: "iot-broker",
      mitigation:
        "Enable authentication on MQTT broker; enforce ACLs per topic; disable anonymous access",
    },
    {
      name: "Physical device tampering",
      description:
        "Attacker with physical access extracts device secrets, firmware, or credentials via JTAG/UART interface.",
      strideCategory: "TAMPERING",
      severity: "HIGH",
      componentId: "iot-device",
      mitigation:
        "Disable debug interfaces in production firmware; store secrets in secure enclave; use hardware root of trust",
    },
  ],
};

// =============================================================================
// Template 8: AI/ML System
// =============================================================================

const aiMlSystemTemplate: Template = {
  name: "AI/ML System",
  description:
    "Machine learning platform with training pipeline, feature store, model serving API, and monitoring.",
  tags: ["ai", "ml", "llm", "training", "inference", "mlops"],
  components: [
    {
      id: "ai-datasource",
      name: "Training Data Source",
      type: "DATA_STORE",
      position: { x: 80, y: 280 },
    },
    {
      id: "ai-pipeline",
      name: "Training Pipeline",
      type: "PROCESS",
      position: { x: 300, y: 280 },
    },
    {
      id: "ai-registry",
      name: "Model Registry",
      type: "DATA_STORE",
      position: { x: 520, y: 160 },
    },
    {
      id: "ai-featurestore",
      name: "Feature Store",
      type: "DATA_STORE",
      position: { x: 300, y: 440 },
    },
    {
      id: "ai-vectordb",
      name: "Vector Database",
      type: "DATA_STORE",
      position: { x: 740, y: 600 },
    },
    {
      id: "ai-serving",
      name: "Model Serving API",
      type: "API",
      position: { x: 740, y: 280 },
    },
    {
      id: "ai-gateway",
      name: "AI Gateway / Proxy",
      type: "API_GATEWAY",
      position: { x: 960, y: 280 },
    },
    {
      id: "ai-client",
      name: "Client Application",
      type: "WEB_APP",
      position: { x: 1180, y: 280 },
    },
    {
      id: "ai-monitoring",
      name: "Model Monitoring",
      type: "PROCESS",
      position: { x: 740, y: 440 },
    },
  ],
  connections: [
    {
      id: "c1",
      source: "ai-datasource",
      target: "ai-pipeline",
      label: "training data",
    },
    {
      id: "c2",
      source: "ai-featurestore",
      target: "ai-pipeline",
      label: "features",
    },
    {
      id: "c3",
      source: "ai-pipeline",
      target: "ai-registry",
      label: "register model",
      protocol: "internal",
    },
    {
      id: "c4",
      source: "ai-registry",
      target: "ai-serving",
      label: "load model",
      protocol: "internal",
    },
    {
      id: "c5",
      source: "ai-vectordb",
      target: "ai-serving",
      label: "RAG retrieval",
      protocol: "internal",
    },
    {
      id: "c6",
      source: "ai-serving",
      target: "ai-gateway",
      label: "inference result",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "c7",
      source: "ai-gateway",
      target: "ai-client",
      label: "response",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "c8",
      source: "ai-client",
      target: "ai-gateway",
      label: "inference request",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "c9",
      source: "ai-serving",
      target: "ai-monitoring",
      label: "predictions + drift metrics",
    },
  ],
  boundaries: [
    {
      id: "b1",
      name: "Training Infrastructure",
      componentIds: [
        "ai-datasource",
        "ai-pipeline",
        "ai-featurestore",
        "ai-registry",
      ],
    },
    {
      id: "b2",
      name: "Inference Infrastructure",
      componentIds: ["ai-serving", "ai-vectordb", "ai-monitoring"],
    },
    { id: "b3", name: "Public API Layer", componentIds: ["ai-gateway"] },
  ],
  threats: [
    {
      name: "Prompt injection via client input",
      description:
        "Attacker embeds malicious instructions in user-controlled input to override system prompt constraints, hijack model behavior, or leak system context.",
      strideCategory: "TAMPERING",
      severity: "CRITICAL",
      componentId: "ai-gateway",
      mitigation:
        "Sanitize inputs; enforce input/output guardrails; separate system prompt from user content; implement output filtering",
    },
    {
      name: "Training data poisoning",
      description:
        "Attacker injects malicious records into the training dataset to introduce backdoors or systematic biases into the deployed model.",
      strideCategory: "TAMPERING",
      severity: "CRITICAL",
      componentId: "ai-pipeline",
      mitigation:
        "Validate training data integrity; anomaly detection on data distributions; restrict write access to training data",
    },
    {
      name: "Model extraction via inference API",
      description:
        "Attacker systematically queries the serving API to reconstruct model behavior, stealing intellectual property.",
      strideCategory: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentId: "ai-serving",
      mitigation:
        "Rate limit inference API; do not return confidence scores; monitor for extraction query patterns",
    },
    {
      name: "Vector database poisoning (RAG)",
      description:
        "Attacker injects malicious documents into the vector database to manipulate retrieval-augmented generation responses.",
      strideCategory: "TAMPERING",
      severity: "HIGH",
      componentId: "ai-vectordb",
      mitigation:
        "Restrict write access to vector DB; validate documents before indexing; content safety scanning on retrieved chunks",
    },
    {
      name: "Excessive agency in agentic workflows",
      description:
        "Model with tool access takes unintended real-world actions (file operations, API calls, code execution) due to crafted inputs or unclear scope.",
      strideCategory: "ELEVATION_OF_PRIVILEGE",
      severity: "CRITICAL",
      componentId: "ai-serving",
      mitigation:
        "Apply least-privilege to all tool permissions; require human confirmation for irreversible actions; scope tool access per request",
    },
    {
      name: "Sensitive data memorization and leakage",
      description:
        "Model memorizes PII or confidential data from training set and reproduces it verbatim in responses.",
      strideCategory: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentId: "ai-pipeline",
      mitigation:
        "Scrub PII from training data; apply differential privacy during training; filter outputs for sensitive patterns",
    },
  ],
};

// =============================================================================
// Template 9: API Gateway
// =============================================================================

const apiGatewayTemplate: Template = {
  name: "API Gateway",
  description:
    "Public API behind a gateway with WAF, auth service, rate limiting, one backend service and database.",
  tags: ["api", "gateway", "waf", "rate-limiting"],
  components: [
    {
      id: "client",
      name: "API Client",
      type: "ACTOR",
      position: { x: 40, y: 260 },
      trustLevel: "EXTERNAL",
    },
    {
      id: "waf",
      name: "WAF",
      type: "FIREWALL",
      position: { x: 340, y: 260 },
      trustLevel: "DMZ",
      description: "Edge filtering, bot and injection rules",
    },
    {
      id: "gateway",
      name: "API Gateway",
      type: "API_GATEWAY",
      position: { x: 560, y: 260 },
      trustLevel: "DMZ",
      description: "Routing, authentication, rate limiting",
    },
    {
      id: "auth",
      name: "Auth Service",
      type: "MICROSERVICE",
      position: { x: 860, y: 100 },
      trustLevel: "INTERNAL",
      description: "Token issuance and validation (OAuth2/OIDC)",
    },
    {
      id: "backend",
      name: "Backend Service",
      type: "MICROSERVICE",
      position: { x: 860, y: 260 },
      trustLevel: "INTERNAL",
      description: "Business logic behind the gateway",
    },
    {
      id: "db",
      name: "Database",
      type: "DATABASE",
      position: { x: 1080, y: 260 },
      trustLevel: "INTERNAL",
    },
    {
      id: "cache",
      name: "Rate Limit Store",
      type: "CACHE",
      position: { x: 860, y: 460 },
      trustLevel: "INTERNAL",
      description: "Counters for quotas and rate limits",
    },
  ],
  connections: [
    {
      id: "e1",
      source: "client",
      target: "waf",
      label: "API Requests",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "e2",
      source: "waf",
      target: "gateway",
      protocol: "HTTPS",
      encrypted: true,
    },
    {
      id: "e3",
      source: "gateway",
      target: "auth",
      label: "Token Validation",
      protocol: "HTTPS",
      encrypted: true,
      authMethod: "MTLS",
    },
    {
      id: "e4",
      source: "gateway",
      target: "backend",
      protocol: "HTTPS",
      encrypted: true,
      authMethod: "MTLS",
    },
    {
      id: "e5",
      source: "backend",
      target: "db",
      protocol: "TCP",
      encrypted: true,
    },
    {
      id: "e6",
      source: "gateway",
      target: "cache",
      label: "Rate Counters",
      protocol: "TCP",
      encrypted: true,
    },
  ],
  boundaries: [
    { id: "b1", name: "Public Internet", componentIds: ["client"] },
    { id: "b2", name: "DMZ", componentIds: ["waf", "gateway"] },
    {
      id: "b3",
      name: "Internal Network",
      componentIds: ["auth", "backend", "db", "cache"],
    },
  ],
  threats: [
    {
      name: "Broken object-level authorization",
      description:
        "Client reads or modifies another tenant's objects by changing IDs in requests",
      strideCategory: "ELEVATION_OF_PRIVILEGE",
      severity: "CRITICAL",
      componentId: "backend",
      mitigation:
        "Enforce object ownership checks in the service, not only at the gateway",
    },
    {
      name: "Stolen or forged access token",
      description: "Attacker replays or forges JWTs to impersonate a client",
      strideCategory: "SPOOFING",
      severity: "HIGH",
      componentId: "auth",
      mitigation:
        "Short token lifetimes, signature and audience validation, key rotation",
    },
    {
      name: "Gateway bypass",
      description:
        "Backend reachable directly, skipping authentication and rate limits",
      strideCategory: "ELEVATION_OF_PRIVILEGE",
      severity: "CRITICAL",
      componentId: "gateway",
      mitigation:
        "Network policy allowing backend traffic only from the gateway; mTLS",
    },
    {
      name: "Volumetric API abuse",
      description: "Flooding or scraping exhausts capacity and quotas",
      strideCategory: "DENIAL_OF_SERVICE",
      severity: "HIGH",
      componentId: "gateway",
      mitigation:
        "Per-client rate limits and quotas, request size limits, autoscaling",
    },
    {
      name: "Injection via request payload",
      description:
        "Malicious input in bodies, headers or query strings reaches the backend",
      strideCategory: "TAMPERING",
      severity: "HIGH",
      componentId: "waf",
      mitigation:
        "Schema validation at the gateway, WAF rules, parameterised queries",
    },
    {
      name: "Excessive data exposure",
      description: "Responses return more fields than the client needs",
      strideCategory: "INFORMATION_DISCLOSURE",
      severity: "MEDIUM",
      componentId: "backend",
      mitigation: "Explicit response schemas, field-level filtering",
    },
    {
      name: "Rate-limit counter tampering",
      description: "Attacker evicts or resets counters in the shared store",
      strideCategory: "TAMPERING",
      severity: "MEDIUM",
      componentId: "cache",
      mitigation:
        "Authenticated store access, network isolation, fail-closed on store loss",
    },
    {
      name: "Missing request audit trail",
      description: "No record of who called which endpoint",
      strideCategory: "REPUDIATION",
      severity: "MEDIUM",
      componentId: "gateway",
      mitigation:
        "Structured access logs with client ID and request ID, shipped to immutable storage",
    },
  ],
};

// =============================================================================
// All templates
// =============================================================================

export const ALL_TEMPLATES: Template[] = [
  webAppTemplate,
  microservicesTemplate,
  serverlessTemplate,
  mobileTemplate,
  saasTemplate,
  dataPipelineTemplate,
  iotEdgeTemplate,
  aiMlSystemTemplate,
  apiGatewayTemplate,
];
