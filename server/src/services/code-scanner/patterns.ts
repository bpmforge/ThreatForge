/**
 * Code Control Scanner — Pattern Definitions
 *
 * Each pattern maps a regex (tested per-line of source code) to a mitigation
 * template that will be used to create a COMPLETED mitigation in the model.
 */

export interface ControlPattern {
  id: string;
  name: string;
  /** Regex tested against each source line */
  regex: RegExp;
  controlCategory: string;
  cwe?: string;
  mitigationDescription: string;
  /** Optional override for the evidence link title */
  evidenceTitle?: string;
}

export const CONTROL_PATTERNS: ControlPattern[] = [
  // ─── Authentication ───────────────────────────────────────────────────────
  {
    id: "jwt-verify",
    name: "JWT Verification",
    regex: /jwt\.verify|verifyToken|decodeAndVerify/i,
    controlCategory: "IAM",
    cwe: "CWE-287",
    mitigationDescription:
      "JWT tokens are cryptographically verified before trusting claims.",
    evidenceTitle: "JWT verification in source",
  },
  {
    id: "bcrypt-hash",
    name: "Password Hashing (bcrypt/argon2/scrypt)",
    regex: /bcrypt\.hash|bcrypt\.compare|argon2\.hash|scrypt\(|pbkdf2\(/i,
    controlCategory: "IAM",
    cwe: "CWE-916",
    mitigationDescription:
      "Passwords are stored using a strong adaptive hashing algorithm (bcrypt/argon2/scrypt).",
    evidenceTitle: "Password hash in source",
  },
  {
    id: "mfa-totp",
    name: "TOTP / MFA",
    regex: /totp\.|speakeasy\.|otpauth|authenticator\.verify|mfa\.verify/i,
    controlCategory: "IAM",
    cwe: "CWE-308",
    mitigationDescription:
      "Multi-factor authentication (TOTP/HOTP) is implemented for user login.",
    evidenceTitle: "MFA / TOTP in source",
  },
  {
    id: "session-httponly",
    name: "HttpOnly / Secure Cookie Flag",
    regex: /httpOnly\s*[:=]\s*true|secure\s*[:=]\s*true|sameSite\s*[:=]/i,
    controlCategory: "IAM",
    cwe: "CWE-1004",
    mitigationDescription:
      "Session cookies are set with HttpOnly, Secure, and SameSite flags to prevent XSS and CSRF theft.",
    evidenceTitle: "Secure cookie flags in source",
  },

  // ─── Encryption / TLS ────────────────────────────────────────────────────
  {
    id: "tls-enforce",
    name: "TLS Enforcement",
    regex:
      /rejectUnauthorized\s*:\s*true|ssl\s*:\s*true|https\.createServer|sslMode/i,
    controlCategory: "ENCRYPTION",
    cwe: "CWE-319",
    mitigationDescription:
      "TLS is enforced for all connections; certificate validation is enabled.",
    evidenceTitle: "TLS enforcement in source",
  },
  {
    id: "aes-encrypt",
    name: "AES Encryption at Rest",
    regex: /aes-256|createCipheriv|AES\.encrypt|fernet|nacl\.secretbox/i,
    controlCategory: "ENCRYPTION",
    cwe: "CWE-311",
    mitigationDescription:
      "Sensitive data is encrypted at rest using AES-256 or equivalent.",
    evidenceTitle: "AES encryption in source",
  },
  {
    id: "env-secret",
    name: "Secrets via Environment Variables",
    regex: /process\.env\.(SECRET|API_KEY|DATABASE_URL|PASSWORD|TOKEN|PRIVATE)/,
    controlCategory: "SECRETS",
    cwe: "CWE-312",
    mitigationDescription:
      "Credentials and secrets are loaded from environment variables, not hardcoded.",
    evidenceTitle: "Env-based secret loading in source",
  },

  // ─── Input Validation ─────────────────────────────────────────────────────
  {
    id: "zod-parse",
    name: "Schema Validation (Zod)",
    regex: /\.parse\(|\.safeParse\(|z\.object|z\.string|z\.number/,
    controlCategory: "INPUT_VALIDATION",
    cwe: "CWE-20",
    mitigationDescription:
      "Input is validated against a Zod schema before processing.",
    evidenceTitle: "Zod schema validation in source",
  },
  {
    id: "joi-validate",
    name: "Schema Validation (Joi / Yup)",
    regex: /Joi\.object|joi\.validate|yup\.object|schema\.validate/i,
    controlCategory: "INPUT_VALIDATION",
    cwe: "CWE-20",
    mitigationDescription:
      "Input is validated against a Joi/Yup schema before processing.",
    evidenceTitle: "Joi/Yup schema validation in source",
  },
  {
    id: "parameterized-query",
    name: "Parameterized Queries",
    regex:
      /\$\d+|:\w+\s*\)|prisma\.\w+\.(findMany|findFirst|create|update|delete)|\.prepare\(/i,
    controlCategory: "INPUT_VALIDATION",
    cwe: "CWE-89",
    mitigationDescription:
      "Database queries use parameterized statements or an ORM to prevent SQL injection.",
    evidenceTitle: "Parameterized query in source",
  },
  {
    id: "html-escape",
    name: "HTML Escaping / XSS Prevention",
    regex: /DOMPurify\.sanitize|escapeHtml|he\.encode|sanitizeHtml|xss\(/i,
    controlCategory: "INPUT_VALIDATION",
    cwe: "CWE-79",
    mitigationDescription:
      "User-supplied HTML is sanitized or escaped before rendering to prevent XSS.",
    evidenceTitle: "HTML sanitization in source",
  },
  {
    id: "csrf-token",
    name: "CSRF Token",
    regex: /csrf|csrfToken|_csrf|X-CSRF-Token|double-submit/i,
    controlCategory: "INPUT_VALIDATION",
    cwe: "CWE-352",
    mitigationDescription:
      "CSRF tokens are used to protect state-changing requests.",
    evidenceTitle: "CSRF protection in source",
  },

  // ─── Access Control ───────────────────────────────────────────────────────
  {
    id: "rbac-check",
    name: "Role-Based Access Control",
    regex:
      /hasRole|checkPermission|can\(|authorize\(|isAuthorized|requireRole/i,
    controlCategory: "ACCESS_CONTROL",
    cwe: "CWE-285",
    mitigationDescription:
      "Access control checks enforce role-based authorization before sensitive operations.",
    evidenceTitle: "RBAC check in source",
  },
  {
    id: "rate-limit",
    name: "Rate Limiting",
    regex: /rateLimit|rate-limit|throttle\(|limiter\.|RateLimiter/i,
    controlCategory: "ACCESS_CONTROL",
    cwe: "CWE-770",
    mitigationDescription:
      "Rate limiting is applied to prevent brute-force and DoS attacks.",
    evidenceTitle: "Rate limiting in source",
  },

  // ─── Logging / Monitoring ─────────────────────────────────────────────────
  {
    id: "audit-log",
    name: "Audit Logging",
    regex: /auditLog|audit\.log|writeAudit|logAudit|audit_trail/i,
    controlCategory: "LOGGING",
    cwe: "CWE-778",
    mitigationDescription:
      "Security-relevant actions are written to an audit log for forensic traceability.",
    evidenceTitle: "Audit log in source",
  },
  {
    id: "structured-log",
    name: "Structured Logging",
    regex:
      /logger\.(info|warn|error|debug)|log\.(info|warn|error)|pino\.|winston\./i,
    controlCategory: "LOGGING",
    cwe: "CWE-532",
    mitigationDescription:
      "Structured logging is used so log entries can be queried and alerted on.",
    evidenceTitle: "Structured logging in source",
  },

  // ─── Network ──────────────────────────────────────────────────────────────
  {
    id: "cors-config",
    name: "CORS Policy",
    regex: /cors\(|allowedOrigins|Access-Control-Allow-Origin|corsOptions/i,
    controlCategory: "NETWORK",
    cwe: "CWE-942",
    mitigationDescription:
      "CORS policy is configured to restrict cross-origin requests to trusted origins.",
    evidenceTitle: "CORS policy in source",
  },
  {
    id: "helmet",
    name: "HTTP Security Headers (Helmet)",
    regex:
      /helmet\(\)|contentSecurityPolicy|X-Frame-Options|X-Content-Type-Options/i,
    controlCategory: "NETWORK",
    cwe: "CWE-116",
    mitigationDescription:
      "HTTP security headers (CSP, X-Frame-Options, etc.) are set via Helmet or equivalent.",
    evidenceTitle: "Security headers in source",
  },

  // ─── Supply Chain ─────────────────────────────────────────────────────────
  {
    id: "dependency-lock",
    name: "Dependency Lock File",
    regex:
      /package-lock\.json|yarn\.lock|pnpm-lock|Pipfile\.lock|Gemfile\.lock/i,
    controlCategory: "SUPPLY_CHAIN",
    cwe: "CWE-1035",
    mitigationDescription:
      "Dependency lock files are committed to pin exact versions and prevent supply chain drift.",
    evidenceTitle: "Lock file in repository",
  },

  // ─── Backup / Recovery ────────────────────────────────────────────────────
  {
    id: "backup-routine",
    name: "Backup Routine",
    regex: /backup\(|createBackup|pg_dump|mysqldump|snapshot\(/i,
    controlCategory: "BACKUP",
    cwe: "CWE-654",
    mitigationDescription:
      "Automated backup routines are implemented to support recovery objectives.",
    evidenceTitle: "Backup routine in source",
  },
];
