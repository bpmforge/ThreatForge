/**
 * Community Marketplace Packs
 *
 * Seed data for three public packs. Each pack becomes:
 *  - a public MitigationLibrary (what the marketplace browses and an org
 *    "installs" by subscribing), and
 *  - a public ThreatLibrary of the same name carrying the threats with
 *    CWE / OWASP references and suggested mitigations.
 *
 * Content is anchored to published taxonomies: OWASP Top 10 (2021),
 * OWASP Kubernetes Top Ten (2022) and OWASP Top 10 for LLM Applications (2025).
 */

type PackStride =
  | "SPOOFING"
  | "TAMPERING"
  | "REPUDIATION"
  | "INFORMATION_DISCLOSURE"
  | "DENIAL_OF_SERVICE"
  | "ELEVATION_OF_PRIVILEGE";

interface PackThreat {
  name: string;
  description: string;
  stride: PackStride;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  componentTypes: string[];
  cweIds: string[];
  owaspIds: string[];
  /** Names of mitigations in the same pack. */
  mitigations: string[];
}

interface PackMitigation {
  name: string;
  description: string;
  strategy: "PREVENTION" | "DETECTION" | "RESPONSE" | "RECOVERY" | "DETERRENCE";
  effort: "TRIVIAL" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  effectiveness: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  steps: string[];
  tags: string[];
}

export interface CommunityPack {
  name: string;
  description: string;
  threats: PackThreat[];
  mitigations: PackMitigation[];
}

const WEB_APP_PACK: CommunityPack = {
  name: "Web Application Security (OWASP Top 10)",
  description:
    "Threats and controls for server-rendered and SPA web applications, organised around the OWASP Top 10 (2021).",
  threats: [
    {
      name: "Broken Object-Level Access Control (IDOR)",
      description:
        "Users read or modify other users' records by changing an identifier in a URL or request body because the server checks authentication but not ownership.",
      stride: "ELEVATION_OF_PRIVILEGE",
      severity: "HIGH",
      componentTypes: ["API", "WEB_APP", "API_GATEWAY"],
      cweIds: ["CWE-639", "CWE-284", "CWE-862"],
      owaspIds: ["A01:2021"],
      mitigations: ["Server-side authorization on every object access"],
    },
    {
      name: "SQL / Command Injection",
      description:
        "Untrusted input concatenated into SQL, OS commands or query languages lets an attacker read, alter or destroy data or execute commands.",
      stride: "TAMPERING",
      severity: "CRITICAL",
      componentTypes: ["API", "WEB_APP", "DATABASE"],
      cweIds: ["CWE-89", "CWE-78"],
      owaspIds: ["A03:2021"],
      mitigations: [
        "Parameterised queries and ORM-only data access",
        "Centralised input validation",
      ],
    },
    {
      name: "Cross-Site Scripting (XSS)",
      description:
        "Attacker-controlled content is rendered unescaped in a victim's browser, enabling session theft, UI redress and actions on the victim's behalf.",
      stride: "TAMPERING",
      severity: "HIGH",
      componentTypes: ["WEB_APP", "API"],
      cweIds: ["CWE-79"],
      owaspIds: ["A03:2021"],
      mitigations: [
        "Context-aware output encoding and strict Content-Security-Policy",
        "Centralised input validation",
      ],
    },
    {
      name: "Cross-Site Request Forgery (CSRF)",
      description:
        "A malicious site causes an authenticated user's browser to submit state-changing requests that the server accepts because the session cookie is sent automatically.",
      stride: "TAMPERING",
      severity: "MEDIUM",
      componentTypes: ["WEB_APP", "API"],
      cweIds: ["CWE-352"],
      owaspIds: ["A01:2021"],
      mitigations: ["SameSite cookies and anti-CSRF tokens"],
    },
    {
      name: "Sensitive Data Exposure in Transit or at Rest",
      description:
        "Credentials, tokens or personal data are transmitted without TLS, stored unencrypted, or protected with weak algorithms.",
      stride: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentTypes: ["DATABASE", "DATA_STORE", "OBJECT_STORAGE", "API"],
      cweIds: ["CWE-311", "CWE-319", "CWE-327"],
      owaspIds: ["A02:2021"],
      mitigations: ["TLS everywhere with HSTS; encrypt sensitive data at rest"],
    },
    {
      name: "Credential Stuffing and Weak Authentication",
      description:
        "Attackers replay breached credentials or brute-force weak passwords against login and password-reset endpoints that lack throttling or MFA.",
      stride: "SPOOFING",
      severity: "HIGH",
      componentTypes: ["AUTH_SERVICE", "WEB_APP", "API"],
      cweIds: ["CWE-287", "CWE-307", "CWE-521"],
      owaspIds: ["A07:2021"],
      mitigations: ["MFA, login rate limiting and breached-password screening"],
    },
    {
      name: "Server-Side Request Forgery (SSRF)",
      description:
        "The server fetches a user-supplied URL, letting an attacker reach internal services or cloud metadata endpoints and steal credentials.",
      stride: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentTypes: ["API", "WEB_APP", "SERVERLESS"],
      cweIds: ["CWE-918"],
      owaspIds: ["A10:2021"],
      mitigations: ["Egress allow-listing and URL fetch hardening"],
    },
    {
      name: "Security Misconfiguration and Verbose Errors",
      description:
        "Default accounts, debug modes, permissive CORS or stack traces in responses reveal internals and widen the attack surface.",
      stride: "INFORMATION_DISCLOSURE",
      severity: "MEDIUM",
      componentTypes: ["WEB_APP", "API", "LOAD_BALANCER"],
      cweIds: ["CWE-16", "CWE-209"],
      owaspIds: ["A05:2021"],
      mitigations: ["Hardened, version-controlled configuration baseline"],
    },
    {
      name: "Vulnerable and Outdated Dependencies",
      description:
        "Known-vulnerable libraries or frameworks are shipped to production because dependencies are unpinned, unmonitored or rarely updated.",
      stride: "TAMPERING",
      severity: "HIGH",
      componentTypes: ["WEB_APP", "API", "MICROSERVICE"],
      cweIds: ["CWE-1104", "CWE-937"],
      owaspIds: ["A06:2021"],
      mitigations: ["Automated dependency scanning with patch SLAs"],
    },
    {
      name: "Insufficient Security Logging and Monitoring",
      description:
        "Authentication failures, access-control denials and admin actions are not logged or alerted on, so attacks go undetected and repudiation is possible.",
      stride: "REPUDIATION",
      severity: "MEDIUM",
      componentTypes: ["API", "AUTH_SERVICE", "MONITORING"],
      cweIds: ["CWE-778", "CWE-223"],
      owaspIds: ["A09:2021"],
      mitigations: ["Centralised security audit logging with alerting"],
    },
  ],
  mitigations: [
    {
      name: "Server-side authorization on every object access",
      description:
        "Enforce an ownership or role check in the data-access layer for every request, deny by default, and never rely on client-side hiding of identifiers.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "VERY_HIGH",
      steps: [
        "Centralise authorization in middleware or a policy module",
        "Scope every query by the caller's tenant and user",
        "Add negative tests that access another user's object and expect 403/404",
      ],
      tags: ["access-control", "owasp-a01"],
    },
    {
      name: "Parameterised queries and ORM-only data access",
      description:
        "Use prepared statements or an ORM for all database access; never build queries by string concatenation, and avoid shell invocation with user input.",
      strategy: "PREVENTION",
      effort: "LOW",
      effectiveness: "VERY_HIGH",
      steps: [
        "Ban raw string-built SQL via lint rules",
        "Run the database account with least privilege",
        "Add SAST rules for query concatenation",
      ],
      tags: ["injection", "owasp-a03"],
    },
    {
      name: "Centralised input validation",
      description:
        "Validate type, length, range and format of all inputs against an allow-list schema at the trust boundary before use.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "HIGH",
      steps: [
        "Define schemas for every request body and query string",
        "Reject unknown fields",
        "Validate again on the server regardless of client checks",
      ],
      tags: ["validation", "owasp-a03"],
    },
    {
      name: "Context-aware output encoding and strict Content-Security-Policy",
      description:
        "Encode untrusted data for the HTML, attribute, JS or URL context it is rendered in, and deploy a nonce-based CSP as defence in depth.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "HIGH",
      steps: [
        "Use a framework that auto-escapes by default",
        "Avoid innerHTML/dangerouslySetInnerHTML with untrusted data",
        "Ship a CSP without unsafe-inline and monitor reports",
      ],
      tags: ["xss", "csp"],
    },
    {
      name: "SameSite cookies and anti-CSRF tokens",
      description:
        "Set session cookies SameSite=Lax or Strict and require a per-session anti-CSRF token or custom header on all state-changing requests.",
      strategy: "PREVENTION",
      effort: "LOW",
      effectiveness: "HIGH",
      steps: [
        "Mark session cookies HttpOnly, Secure and SameSite",
        "Verify Origin/Referer on unsafe methods",
        "Use synchroniser or double-submit tokens for form posts",
      ],
      tags: ["csrf", "session"],
    },
    {
      name: "TLS everywhere with HSTS; encrypt sensitive data at rest",
      description:
        "Require TLS 1.2+ for all connections, enable HSTS, and encrypt sensitive columns and storage with vetted algorithms and managed keys.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "HIGH",
      steps: [
        "Terminate TLS with modern cipher suites",
        "Use a KMS for key management and rotation",
        "Hash passwords with Argon2id, scrypt or bcrypt",
      ],
      tags: ["crypto", "owasp-a02"],
    },
    {
      name: "MFA, login rate limiting and breached-password screening",
      description:
        "Offer or require multi-factor authentication, throttle authentication endpoints per account and IP, and reject known-breached passwords.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "HIGH",
      steps: [
        "Enforce progressive delays or lockout with alerting",
        "Check new passwords against a breached-password list",
        "Invalidate sessions on password change",
      ],
      tags: ["authentication", "owasp-a07"],
    },
    {
      name: "Egress allow-listing and URL fetch hardening",
      description:
        "Restrict outbound requests to approved hosts, resolve and validate destinations after DNS, block link-local and private ranges, and require IMDSv2 on cloud hosts.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "HIGH",
      steps: [
        "Allow-list schemes, hosts and ports",
        "Block 169.254.0.0/16 and RFC 1918 ranges after resolution",
        "Disable redirects or re-validate each hop",
      ],
      tags: ["ssrf", "owasp-a10"],
    },
    {
      name: "Hardened, version-controlled configuration baseline",
      description:
        "Define a minimal hardened configuration as code, remove defaults and debug features, return generic errors to clients, and verify drift in CI.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "MEDIUM",
      steps: [
        "Disable debug and directory listing in production",
        "Set security headers and restrictive CORS",
        "Log detailed errors server-side only",
      ],
      tags: ["configuration", "owasp-a05"],
    },
    {
      name: "Automated dependency scanning with patch SLAs",
      description:
        "Maintain an SBOM, scan dependencies on every build, and enforce time-boxed remediation by severity.",
      strategy: "DETECTION",
      effort: "LOW",
      effectiveness: "HIGH",
      steps: [
        "Enable SCA in CI and fail builds on known-exploited CVEs",
        "Pin versions with lockfiles",
        "Automate update pull requests",
      ],
      tags: ["supply-chain", "owasp-a06"],
    },
    {
      name: "Centralised security audit logging with alerting",
      description:
        "Emit structured, tamper-resistant logs for authentication, authorization failures and privileged actions, and alert on anomalies.",
      strategy: "DETECTION",
      effort: "MEDIUM",
      effectiveness: "MEDIUM",
      steps: [
        "Log who, what, when and outcome without secrets",
        "Ship logs to append-only central storage",
        "Alert on repeated failures and privilege changes",
      ],
      tags: ["logging", "owasp-a09"],
    },
  ],
};

const KUBERNETES_PACK: CommunityPack = {
  name: "Microservices on Kubernetes",
  description:
    "Threats and controls for containerised microservices running on Kubernetes, mapped to the OWASP Kubernetes Top Ten (2022).",
  threats: [
    {
      name: "Privileged Container Escape",
      description:
        "A workload running as root, privileged, or with host namespaces and sensitive capabilities lets a compromised container break out to the node.",
      stride: "ELEVATION_OF_PRIVILEGE",
      severity: "CRITICAL",
      componentTypes: ["KUBERNETES", "MICROSERVICE"],
      cweIds: ["CWE-250", "CWE-269"],
      owaspIds: ["K01:2022"],
      mitigations: ["Pod Security Standards (restricted) enforcement"],
    },
    {
      name: "Overly Permissive RBAC and Service Accounts",
      description:
        "Wildcard roles, cluster-admin bindings or default service-account tokens let a compromised pod read secrets or alter workloads cluster-wide.",
      stride: "ELEVATION_OF_PRIVILEGE",
      severity: "HIGH",
      componentTypes: ["KUBERNETES"],
      cweIds: ["CWE-269", "CWE-732"],
      owaspIds: ["K03:2022"],
      mitigations: ["Least-privilege RBAC and dedicated service accounts"],
    },
    {
      name: "Secrets Exposed in Manifests, Env Vars or etcd",
      description:
        "Credentials are committed in manifests, injected as plain environment variables, or stored unencrypted in etcd where any reader of the API or backup can recover them.",
      stride: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentTypes: ["KUBERNETES", "MICROSERVICE"],
      cweIds: ["CWE-312", "CWE-522", "CWE-798"],
      owaspIds: ["K08:2022"],
      mitigations: ["External secrets manager and etcd encryption at rest"],
    },
    {
      name: "Flat Pod Network Enables Lateral Movement",
      description:
        "Without network policies every pod can reach every other pod and the metadata service, so one compromised service exposes the whole cluster.",
      stride: "TAMPERING",
      severity: "HIGH",
      componentTypes: ["KUBERNETES", "MICROSERVICE"],
      cweIds: ["CWE-284", "CWE-923"],
      owaspIds: ["K07:2022"],
      mitigations: ["Default-deny NetworkPolicies and service mesh mTLS"],
    },
    {
      name: "Compromised or Unverified Container Images",
      description:
        "Images pulled from public registries by mutable tag, or built from unpatched base layers, introduce malware or known vulnerabilities.",
      stride: "TAMPERING",
      severity: "HIGH",
      componentTypes: ["KUBERNETES", "MICROSERVICE"],
      cweIds: ["CWE-494", "CWE-1357"],
      owaspIds: ["K02:2022", "K10:2022"],
      mitigations: ["Signed images, digest pinning and admission verification"],
    },
    {
      name: "Unauthenticated Service-to-Service Calls",
      description:
        "Internal services trust any caller on the cluster network, so an attacker with pod access can impersonate a service and call privileged APIs.",
      stride: "SPOOFING",
      severity: "HIGH",
      componentTypes: ["MICROSERVICE", "API_GATEWAY"],
      cweIds: ["CWE-306", "CWE-287"],
      owaspIds: ["K06:2022"],
      mitigations: ["Default-deny NetworkPolicies and service mesh mTLS"],
    },
    {
      name: "Exposed Control Plane, Kubelet or Dashboard",
      description:
        "The API server, kubelet or a management dashboard is reachable from untrusted networks with anonymous or weak authentication.",
      stride: "ELEVATION_OF_PRIVILEGE",
      severity: "CRITICAL",
      componentTypes: ["KUBERNETES"],
      cweIds: ["CWE-306", "CWE-668"],
      owaspIds: ["K09:2022"],
      mitigations: [
        "Private control plane, disabled anonymous auth, CIS benchmark",
      ],
    },
    {
      name: "Missing Cluster Audit Logging",
      description:
        "API-server audit logs and runtime events are not collected, so privilege escalation, exec into pods and secret reads go undetected.",
      stride: "REPUDIATION",
      severity: "MEDIUM",
      componentTypes: ["KUBERNETES", "MONITORING"],
      cweIds: ["CWE-778"],
      owaspIds: ["K05:2022"],
      mitigations: ["Kubernetes audit policy and runtime threat detection"],
    },
    {
      name: "Resource Exhaustion by a Noisy or Malicious Workload",
      description:
        "Pods without CPU, memory or ephemeral-storage limits can starve neighbours and the node, causing cascading outages.",
      stride: "DENIAL_OF_SERVICE",
      severity: "MEDIUM",
      componentTypes: ["KUBERNETES", "MICROSERVICE"],
      cweIds: ["CWE-770", "CWE-400"],
      owaspIds: ["K01:2022"],
      mitigations: ["Resource requests, limits and namespace quotas"],
    },
  ],
  mitigations: [
    {
      name: "Pod Security Standards (restricted) enforcement",
      description:
        "Enforce the restricted Pod Security Standard per namespace: non-root, no privilege escalation, dropped capabilities, read-only root filesystem and seccomp RuntimeDefault.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "VERY_HIGH",
      steps: [
        "Label namespaces with pod-security.kubernetes.io/enforce=restricted",
        "Fix non-compliant workloads in audit/warn mode first",
        "Block hostPath, hostNetwork and privileged containers",
      ],
      tags: ["pod-security", "k01"],
    },
    {
      name: "Least-privilege RBAC and dedicated service accounts",
      description:
        "Grant namespaced Roles with explicit verbs and resources, avoid wildcards and cluster-admin, and disable token automount where the API is not needed.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "HIGH",
      steps: [
        "Create one service account per workload",
        "Set automountServiceAccountToken: false by default",
        "Review bindings periodically with an RBAC audit tool",
      ],
      tags: ["rbac", "k03"],
    },
    {
      name: "External secrets manager and etcd encryption at rest",
      description:
        "Source secrets from a managed vault or cloud secret store at runtime, and enable envelope encryption of Secret objects in etcd.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "HIGH",
      steps: [
        "Configure an EncryptionConfiguration with a KMS provider",
        "Mount secrets as files rather than environment variables",
        "Scan repositories for committed secrets",
      ],
      tags: ["secrets", "k08"],
    },
    {
      name: "Default-deny NetworkPolicies and service mesh mTLS",
      description:
        "Apply a default-deny policy in every namespace, allow only required flows, and use mutual TLS with workload identity for service-to-service authentication.",
      strategy: "PREVENTION",
      effort: "HIGH",
      effectiveness: "HIGH",
      steps: [
        "Deploy a CNI that enforces NetworkPolicy",
        "Add explicit ingress and egress allow rules per service",
        "Enable strict mTLS and authorization policies in the mesh",
      ],
      tags: ["network", "mtls", "k07"],
    },
    {
      name: "Signed images, digest pinning and admission verification",
      description:
        "Build from minimal, patched base images, sign them in CI, deploy by digest from a private registry, and verify signatures with an admission controller.",
      strategy: "PREVENTION",
      effort: "HIGH",
      effectiveness: "HIGH",
      steps: [
        "Scan images in CI and block critical CVEs",
        "Sign with Sigstore cosign and publish SBOMs",
        "Enforce verification with Kyverno or OPA Gatekeeper",
      ],
      tags: ["supply-chain", "k02"],
    },
    {
      name: "Private control plane, disabled anonymous auth, CIS benchmark",
      description:
        "Keep the API server and kubelet off public networks, disable anonymous access, and continuously assess cluster configuration against the CIS Kubernetes Benchmark.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "VERY_HIGH",
      steps: [
        "Restrict API server access by IP allow-list or private endpoint",
        "Set --anonymous-auth=false on kubelets",
        "Run kube-bench on a schedule and track findings",
      ],
      tags: ["hardening", "k09"],
    },
    {
      name: "Kubernetes audit policy and runtime threat detection",
      description:
        "Enable API-server audit logging at a useful level and deploy runtime detection for suspicious syscalls, exec sessions and secret access.",
      strategy: "DETECTION",
      effort: "MEDIUM",
      effectiveness: "MEDIUM",
      steps: [
        "Forward audit logs to central, immutable storage",
        "Deploy Falco or equivalent runtime rules",
        "Alert on exec into production pods and RBAC changes",
      ],
      tags: ["logging", "k05"],
    },
    {
      name: "Resource requests, limits and namespace quotas",
      description:
        "Set CPU, memory and ephemeral-storage requests and limits on all containers, and cap totals with ResourceQuota and LimitRange.",
      strategy: "PREVENTION",
      effort: "LOW",
      effectiveness: "MEDIUM",
      steps: [
        "Enforce limits with an admission policy",
        "Apply a ResourceQuota per namespace",
        "Use PodDisruptionBudgets for critical services",
      ],
      tags: ["availability", "k01"],
    },
  ],
};

const LLM_PACK: CommunityPack = {
  name: "LLM and AI Application Security",
  description:
    "Threats and controls for applications built on large language models, agents and RAG pipelines, mapped to the OWASP Top 10 for LLM Applications (2025).",
  threats: [
    {
      name: "Prompt Injection (Direct and Indirect)",
      description:
        "Crafted user input, or instructions hidden in retrieved documents, web pages or tool output, override system instructions and steer the model into unintended actions.",
      stride: "TAMPERING",
      severity: "CRITICAL",
      componentTypes: ["API", "MICROSERVICE", "PROCESS"],
      cweIds: ["CWE-1427", "CWE-77"],
      owaspIds: ["LLM01:2025"],
      mitigations: [
        "Segregate untrusted content and constrain model instructions",
        "Human approval for high-impact tool actions",
      ],
    },
    {
      name: "Sensitive Information Disclosure via Model Output",
      description:
        "The model reveals personal data, credentials or proprietary content from its context, fine-tuning data or connected systems.",
      stride: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentTypes: ["API", "DATA_STORE", "PROCESS"],
      cweIds: ["CWE-200", "CWE-359"],
      owaspIds: ["LLM02:2025"],
      mitigations: ["Data minimisation, redaction and output filtering"],
    },
    {
      name: "Compromised Model or Dependency Supply Chain",
      description:
        "Third-party models, adapters, datasets or plugins are tampered with or backdoored, or loaded from untrusted sources using unsafe serialisation formats.",
      stride: "TAMPERING",
      severity: "HIGH",
      componentTypes: ["PROCESS", "MICROSERVICE", "OBJECT_STORAGE"],
      cweIds: ["CWE-494", "CWE-1357", "CWE-502"],
      owaspIds: ["LLM03:2025"],
      mitigations: ["Model and dataset provenance verification"],
    },
    {
      name: "Training or Fine-Tuning Data Poisoning",
      description:
        "Malicious or low-integrity data inserted into training, fine-tuning or embedding corpora biases outputs or plants backdoor behaviour.",
      stride: "TAMPERING",
      severity: "HIGH",
      componentTypes: ["DATA_STORE", "PROCESS", "OBJECT_STORAGE"],
      cweIds: ["CWE-345", "CWE-20"],
      owaspIds: ["LLM04:2025"],
      mitigations: ["Model and dataset provenance verification"],
    },
    {
      name: "Improper Handling of Model Output",
      description:
        "Model output is passed unchecked to a browser, shell, SQL engine or downstream API, turning the model into a vector for XSS, injection or SSRF.",
      stride: "TAMPERING",
      severity: "HIGH",
      componentTypes: ["WEB_APP", "API", "PROCESS"],
      cweIds: ["CWE-79", "CWE-94", "CWE-116"],
      owaspIds: ["LLM05:2025"],
      mitigations: ["Treat model output as untrusted input"],
    },
    {
      name: "Excessive Agency in Agents and Tools",
      description:
        "An agent holds broader tools, permissions or autonomy than its task needs, so a manipulated model can delete data, send messages or move money.",
      stride: "ELEVATION_OF_PRIVILEGE",
      severity: "HIGH",
      componentTypes: ["PROCESS", "MICROSERVICE", "API"],
      cweIds: ["CWE-269", "CWE-250"],
      owaspIds: ["LLM06:2025"],
      mitigations: [
        "Least-privilege, user-scoped tool permissions",
        "Human approval for high-impact tool actions",
      ],
    },
    {
      name: "System Prompt Leakage",
      description:
        "Hidden instructions are extracted by prompting, exposing business logic, filtering rules or embedded secrets that were assumed to be confidential.",
      stride: "INFORMATION_DISCLOSURE",
      severity: "MEDIUM",
      componentTypes: ["API", "PROCESS"],
      cweIds: ["CWE-200", "CWE-522"],
      owaspIds: ["LLM07:2025"],
      mitigations: ["Data minimisation, redaction and output filtering"],
    },
    {
      name: "RAG and Vector Store Access-Control Bypass",
      description:
        "Embeddings of documents from many tenants or sensitivity levels share one index without per-user filtering, so retrieval surfaces content the caller may not see.",
      stride: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentTypes: ["DATA_STORE", "DATABASE", "API"],
      cweIds: ["CWE-285", "CWE-639"],
      owaspIds: ["LLM08:2025"],
      mitigations: ["Enforce document permissions at retrieval time"],
    },
    {
      name: "Unbounded Consumption and Denial of Wallet",
      description:
        "Unthrottled requests, huge prompts or recursive agent loops exhaust GPU capacity or run up token costs, degrading service or causing financial loss.",
      stride: "DENIAL_OF_SERVICE",
      severity: "MEDIUM",
      componentTypes: ["API", "API_GATEWAY", "PROCESS"],
      cweIds: ["CWE-770", "CWE-400"],
      owaspIds: ["LLM10:2025"],
      mitigations: ["Per-user rate limits, token budgets and loop caps"],
    },
  ],
  mitigations: [
    {
      name: "Segregate untrusted content and constrain model instructions",
      description:
        "Clearly delimit untrusted retrieved or user content from instructions, give the model a narrow task, and validate that outputs conform to an expected schema.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "MEDIUM",
      steps: [
        "Pass untrusted content in a clearly marked data channel",
        "Require structured output and reject non-conforming responses",
        "Red-team with indirect-injection test corpora before release",
      ],
      tags: ["prompt-injection", "llm01"],
    },
    {
      name: "Human approval for high-impact tool actions",
      description:
        "Require explicit user confirmation before irreversible or sensitive actions such as sending email, deleting data, payments or code execution.",
      strategy: "PREVENTION",
      effort: "LOW",
      effectiveness: "HIGH",
      steps: [
        "Classify tools by impact and gate high-impact ones",
        "Show the exact action and parameters to the approver",
        "Log approvals with the originating prompt",
      ],
      tags: ["agency", "llm06"],
    },
    {
      name: "Least-privilege, user-scoped tool permissions",
      description:
        "Expose only the tools the task needs, run them with the end user's delegated credentials rather than a shared service identity, and deny by default.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "HIGH",
      steps: [
        "Inventory tools and trim to the minimum set",
        "Use OAuth on-behalf-of tokens with narrow scopes",
        "Enforce authorization in the tool, never in the prompt",
      ],
      tags: ["agency", "authorization", "llm06"],
    },
    {
      name: "Data minimisation, redaction and output filtering",
      description:
        "Keep secrets and unnecessary personal data out of prompts, training sets and system prompts, and scan model output for sensitive patterns before returning it.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "MEDIUM",
      steps: [
        "Never place credentials or API keys in prompts",
        "Redact PII before sending to external providers",
        "Apply DLP-style filters on responses and logs",
      ],
      tags: ["privacy", "llm02", "llm07"],
    },
    {
      name: "Model and dataset provenance verification",
      description:
        "Obtain models and datasets from trusted sources, verify hashes and signatures, prefer safe formats such as safetensors, and review third-party plugins.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "HIGH",
      steps: [
        "Pin artifacts by digest and record them in an ML-BOM",
        "Avoid pickle-based model files from untrusted sources",
        "Version, review and access-control training data pipelines",
      ],
      tags: ["supply-chain", "llm03", "llm04"],
    },
    {
      name: "Treat model output as untrusted input",
      description:
        "Apply the same encoding, validation and parameterisation to model output as to any user input before it reaches a browser, interpreter, database or API.",
      strategy: "PREVENTION",
      effort: "LOW",
      effectiveness: "HIGH",
      steps: [
        "HTML-encode output rendered in the UI",
        "Never pass model output to eval, shell or raw SQL",
        "Validate generated URLs and API calls against allow-lists",
      ],
      tags: ["output-handling", "llm05"],
    },
    {
      name: "Enforce document permissions at retrieval time",
      description:
        "Attach access-control metadata to every chunk and filter vector search results by the caller's entitlements, with tenant-partitioned indexes where required.",
      strategy: "PREVENTION",
      effort: "MEDIUM",
      effectiveness: "VERY_HIGH",
      steps: [
        "Store ACL and tenant identifiers with each embedding",
        "Apply the filter inside the vector query, not after generation",
        "Test cross-tenant retrieval with canary documents",
      ],
      tags: ["rag", "access-control", "llm08"],
    },
    {
      name: "Per-user rate limits, token budgets and loop caps",
      description:
        "Limit request rate, input and output tokens, tool-call depth and spend per user and tenant, and alert on cost anomalies.",
      strategy: "PREVENTION",
      effort: "LOW",
      effectiveness: "HIGH",
      steps: [
        "Cap max_tokens and context size per request",
        "Bound agent iterations and tool-call chains",
        "Set budget alerts and hard spend ceilings",
      ],
      tags: ["availability", "cost", "llm10"],
    },
  ],
};

export const COMMUNITY_PACKS: CommunityPack[] = [
  WEB_APP_PACK,
  KUBERNETES_PACK,
  LLM_PACK,
];
