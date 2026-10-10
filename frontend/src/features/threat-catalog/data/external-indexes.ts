/**
 * External Source Search Indexes
 *
 * Lightweight indexes for MITRE ATT&CK, CWE, and CAPEC.
 * Contains only what's needed for search - full data fetched on demand.
 */
import type { ThreatIndexEntry } from "../types";
/**
 * MITRE ATT&CK Enterprise Index (subset of ~200 key techniques)
 * Full list: https://attack.mitre.org/techniques/enterprise/
 */
export const mitreAttackIndex: ThreatIndexEntry[] = [
  // Initial Access
  {
    id: "T1190",
    name: "Exploit Public-Facing Application",
    keywords: ["exploit", "public", "web", "application", "vulnerability"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["initial-access"],
  },
  {
    id: "T1566",
    name: "Phishing",
    keywords: ["phishing", "email", "spearphishing", "attachment", "link"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["initial-access", "social-engineering"],
  },
  {
    id: "T1078",
    name: "Valid Accounts",
    keywords: ["valid", "accounts", "credentials", "stolen", "compromised"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["initial-access", "persistence"],
  },
  {
    id: "T1133",
    name: "External Remote Services",
    keywords: ["remote", "vpn", "rdp", "ssh", "citrix"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["initial-access"],
  },
  {
    id: "T1199",
    name: "Trusted Relationship",
    keywords: ["supply", "chain", "vendor", "third-party", "trusted"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["initial-access"],
  },

  // Execution
  {
    id: "T1059",
    name: "Command and Scripting Interpreter",
    keywords: ["command", "script", "powershell", "bash", "python"],
    strideCategories: ["TAMPERING"],
    severity: "HIGH",
    tags: ["execution"],
  },
  {
    id: "T1203",
    name: "Exploitation for Client Execution",
    keywords: ["client", "exploit", "browser", "office", "pdf"],
    strideCategories: ["TAMPERING"],
    severity: "HIGH",
    tags: ["execution"],
  },
  {
    id: "T1204",
    name: "User Execution",
    keywords: ["user", "execution", "malicious", "file", "link"],
    strideCategories: ["TAMPERING"],
    severity: "MEDIUM",
    tags: ["execution"],
  },

  // Persistence
  {
    id: "T1098",
    name: "Account Manipulation",
    keywords: ["account", "manipulation", "add", "modify", "permissions"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    tags: ["persistence"],
  },
  {
    id: "T1136",
    name: "Create Account",
    keywords: ["create", "account", "backdoor", "user", "admin"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    tags: ["persistence"],
  },
  {
    id: "T1543",
    name: "Create or Modify System Process",
    keywords: ["service", "daemon", "systemd", "launchd", "persist"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    tags: ["persistence"],
  },

  // Privilege Escalation
  {
    id: "T1548",
    name: "Abuse Elevation Control Mechanism",
    keywords: ["sudo", "uac", "setuid", "elevation", "bypass"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    tags: ["privilege-escalation"],
  },
  {
    id: "T1068",
    name: "Exploitation for Privilege Escalation",
    keywords: ["kernel", "exploit", "local", "privilege", "escalation"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "CRITICAL",
    tags: ["privilege-escalation"],
  },
  {
    id: "T1134",
    name: "Access Token Manipulation",
    keywords: ["token", "impersonation", "runas", "maketoken", "steal"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    tags: ["privilege-escalation"],
  },

  // Defense Evasion
  {
    id: "T1070",
    name: "Indicator Removal",
    keywords: ["log", "delete", "clear", "remove", "evidence"],
    strideCategories: ["REPUDIATION"],
    severity: "MEDIUM",
    tags: ["defense-evasion"],
  },
  {
    id: "T1562",
    name: "Impair Defenses",
    keywords: ["disable", "antivirus", "firewall", "logging", "security"],
    strideCategories: ["REPUDIATION"],
    severity: "HIGH",
    tags: ["defense-evasion"],
  },
  {
    id: "T1036",
    name: "Masquerading",
    keywords: ["masquerade", "rename", "disguise", "legitimate", "binary"],
    strideCategories: ["REPUDIATION"],
    severity: "MEDIUM",
    tags: ["defense-evasion"],
  },

  // Credential Access
  {
    id: "T1110",
    name: "Brute Force",
    keywords: ["brute", "force", "password", "spray", "credential"],
    strideCategories: ["SPOOFING"],
    severity: "MEDIUM",
    tags: ["credential-access"],
  },
  {
    id: "T1555",
    name: "Credentials from Password Stores",
    keywords: ["keychain", "credential", "manager", "browser", "password"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["credential-access"],
  },
  {
    id: "T1003",
    name: "OS Credential Dumping",
    keywords: ["lsass", "sam", "ntds", "mimikatz", "credential", "dump"],
    strideCategories: ["SPOOFING"],
    severity: "CRITICAL",
    tags: ["credential-access"],
  },

  // Discovery
  {
    id: "T1087",
    name: "Account Discovery",
    keywords: ["account", "discovery", "enumerate", "users", "groups"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "LOW",
    tags: ["discovery"],
  },
  {
    id: "T1046",
    name: "Network Service Discovery",
    keywords: ["port", "scan", "network", "service", "discovery"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "LOW",
    tags: ["discovery"],
  },
  {
    id: "T1057",
    name: "Process Discovery",
    keywords: ["process", "list", "discovery", "running", "ps"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "LOW",
    tags: ["discovery"],
  },

  // Collection
  {
    id: "T1005",
    name: "Data from Local System",
    keywords: ["data", "local", "file", "collect", "sensitive"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["collection"],
  },
  {
    id: "T1114",
    name: "Email Collection",
    keywords: ["email", "collect", "exchange", "outlook", "mail"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["collection"],
  },
  {
    id: "T1213",
    name: "Data from Information Repositories",
    keywords: ["sharepoint", "confluence", "repository", "wiki", "data"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["collection"],
  },

  // Exfiltration
  {
    id: "T1041",
    name: "Exfiltration Over C2 Channel",
    keywords: ["exfiltrate", "c2", "command", "control", "data"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["exfiltration"],
  },
  {
    id: "T1048",
    name: "Exfiltration Over Alternative Protocol",
    keywords: ["dns", "exfiltration", "tunnel", "alternative", "protocol"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["exfiltration"],
  },
  {
    id: "T1567",
    name: "Exfiltration Over Web Service",
    keywords: ["cloud", "storage", "dropbox", "gdrive", "exfiltrate"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["exfiltration"],
  },

  // Impact
  {
    id: "T1485",
    name: "Data Destruction",
    keywords: ["destroy", "wipe", "delete", "ransomware", "data"],
    strideCategories: ["DENIAL_OF_SERVICE"],
    severity: "CRITICAL",
    tags: ["impact"],
  },
  {
    id: "T1486",
    name: "Data Encrypted for Impact",
    keywords: ["ransomware", "encrypt", "ransom", "lock", "crypto"],
    strideCategories: ["DENIAL_OF_SERVICE"],
    severity: "CRITICAL",
    tags: ["impact"],
  },
  {
    id: "T1499",
    name: "Endpoint Denial of Service",
    keywords: ["dos", "denial", "service", "endpoint", "crash"],
    strideCategories: ["DENIAL_OF_SERVICE"],
    severity: "HIGH",
    tags: ["impact"],
  },
  {
    id: "T1498",
    name: "Network Denial of Service",
    keywords: ["ddos", "network", "flood", "amplification", "reflection"],
    strideCategories: ["DENIAL_OF_SERVICE"],
    severity: "HIGH",
    tags: ["impact"],
  },

  // Cloud-specific
  {
    id: "T1078.004",
    name: "Cloud Accounts",
    keywords: ["cloud", "aws", "azure", "gcp", "accounts", "iam"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["initial-access", "cloud"],
  },
  {
    id: "T1530",
    name: "Data from Cloud Storage",
    keywords: ["s3", "blob", "bucket", "cloud", "storage"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["collection", "cloud"],
  },
  {
    id: "T1537",
    name: "Transfer Data to Cloud Account",
    keywords: ["cloud", "transfer", "exfiltration", "account", "data"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["exfiltration", "cloud"],
  },
  {
    id: "T1552.005",
    name: "Cloud Instance Metadata API",
    keywords: ["metadata", "imds", "instance", "ssrf", "credential"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["credential-access", "cloud"],
  },
];

/**
 * CWE Index (subset of ~100 most relevant weaknesses)
 * Full list: https://cwe.mitre.org/
 */
export const cweIndex: ThreatIndexEntry[] = [
  // Injection
  {
    id: "CWE-89",
    name: "SQL Injection",
    keywords: ["sql", "injection", "database", "query", "sqli"],
    strideCategories: ["TAMPERING"],
    severity: "CRITICAL",
    tags: ["injection", "database"],
  },
  {
    id: "CWE-79",
    name: "Cross-site Scripting (XSS)",
    keywords: ["xss", "script", "cross-site", "javascript", "html"],
    strideCategories: ["TAMPERING"],
    severity: "HIGH",
    tags: ["injection", "web"],
  },
  {
    id: "CWE-78",
    name: "OS Command Injection",
    keywords: ["command", "injection", "shell", "os", "execute"],
    strideCategories: ["TAMPERING"],
    severity: "CRITICAL",
    tags: ["injection"],
  },
  {
    id: "CWE-94",
    name: "Code Injection",
    keywords: ["code", "injection", "eval", "execute", "arbitrary"],
    strideCategories: ["TAMPERING"],
    severity: "CRITICAL",
    tags: ["injection"],
  },
  {
    id: "CWE-917",
    name: "Expression Language Injection",
    keywords: ["el", "expression", "template", "injection", "ognl"],
    strideCategories: ["TAMPERING"],
    severity: "CRITICAL",
    tags: ["injection"],
  },
  {
    id: "CWE-611",
    name: "XXE - XML External Entity",
    keywords: ["xml", "xxe", "entity", "external", "dtd"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["injection", "xml"],
  },

  // Authentication
  {
    id: "CWE-287",
    name: "Improper Authentication",
    keywords: ["authentication", "login", "bypass", "improper", "auth"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["authentication"],
  },
  {
    id: "CWE-306",
    name: "Missing Authentication",
    keywords: [
      "missing",
      "authentication",
      "unauthenticated",
      "access",
      "anonymous",
    ],
    strideCategories: ["SPOOFING"],
    severity: "CRITICAL",
    tags: ["authentication"],
  },
  {
    id: "CWE-384",
    name: "Session Fixation",
    keywords: ["session", "fixation", "hijack", "token", "cookie"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["session"],
  },
  {
    id: "CWE-798",
    name: "Hard-coded Credentials",
    keywords: ["hardcoded", "credentials", "password", "secret", "embedded"],
    strideCategories: ["SPOOFING"],
    severity: "CRITICAL",
    tags: ["credentials"],
  },
  {
    id: "CWE-521",
    name: "Weak Password Requirements",
    keywords: ["password", "weak", "policy", "requirements", "complexity"],
    strideCategories: ["SPOOFING"],
    severity: "MEDIUM",
    tags: ["authentication"],
  },

  // Authorization
  {
    id: "CWE-284",
    name: "Improper Access Control",
    keywords: ["access", "control", "authorization", "permission", "acl"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    tags: ["authorization"],
  },
  {
    id: "CWE-285",
    name: "Improper Authorization",
    keywords: ["authorization", "privilege", "permission", "check", "bypass"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    tags: ["authorization"],
  },
  {
    id: "CWE-639",
    name: "Authorization Bypass Through User-Controlled Key",
    keywords: ["idor", "insecure", "direct", "object", "reference"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    tags: ["authorization"],
  },
  {
    id: "CWE-269",
    name: "Improper Privilege Management",
    keywords: ["privilege", "escalation", "management", "permissions", "admin"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    tags: ["authorization"],
  },
  {
    id: "CWE-732",
    name: "Incorrect Permission Assignment",
    keywords: ["permission", "file", "world", "readable", "writable"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "MEDIUM",
    tags: ["permissions"],
  },

  // Cryptography
  {
    id: "CWE-327",
    name: "Use of Broken Crypto Algorithm",
    keywords: ["crypto", "md5", "sha1", "des", "weak", "algorithm"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["cryptography"],
  },
  {
    id: "CWE-326",
    name: "Inadequate Encryption Strength",
    keywords: ["encryption", "key", "size", "weak", "strength"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["cryptography"],
  },
  {
    id: "CWE-319",
    name: "Cleartext Transmission",
    keywords: ["cleartext", "plaintext", "http", "unencrypted", "transmission"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["cryptography", "network"],
  },
  {
    id: "CWE-311",
    name: "Missing Encryption",
    keywords: ["encryption", "missing", "plaintext", "storage", "sensitive"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["cryptography"],
  },
  {
    id: "CWE-330",
    name: "Insufficient Random Values",
    keywords: ["random", "prng", "predictable", "seed", "entropy"],
    strideCategories: ["SPOOFING"],
    severity: "MEDIUM",
    tags: ["cryptography"],
  },

  // Input Validation
  {
    id: "CWE-20",
    name: "Improper Input Validation",
    keywords: ["input", "validation", "sanitize", "filter", "check"],
    strideCategories: ["TAMPERING"],
    severity: "HIGH",
    tags: ["validation"],
  },
  {
    id: "CWE-22",
    name: "Path Traversal",
    keywords: ["path", "traversal", "directory", "file", "lfi"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["file"],
  },
  {
    id: "CWE-918",
    name: "Server-Side Request Forgery (SSRF)",
    keywords: ["ssrf", "server-side", "request", "forgery", "url"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["network"],
  },
  {
    id: "CWE-601",
    name: "Open Redirect",
    keywords: ["redirect", "open", "url", "phishing", "forward"],
    strideCategories: ["SPOOFING"],
    severity: "MEDIUM",
    tags: ["web"],
  },
  {
    id: "CWE-434",
    name: "Unrestricted File Upload",
    keywords: ["file", "upload", "unrestricted", "webshell", "extension"],
    strideCategories: ["TAMPERING"],
    severity: "HIGH",
    tags: ["file"],
  },

  // Information Disclosure
  {
    id: "CWE-200",
    name: "Exposure of Sensitive Information",
    keywords: ["sensitive", "exposure", "disclosure", "leak", "data"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "MEDIUM",
    tags: ["disclosure"],
  },
  {
    id: "CWE-209",
    name: "Error Information Exposure",
    keywords: ["error", "stack", "trace", "debug", "information"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "LOW",
    tags: ["disclosure"],
  },
  {
    id: "CWE-532",
    name: "Information Exposure Through Logs",
    keywords: ["log", "sensitive", "password", "exposure", "logging"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "MEDIUM",
    tags: ["logging"],
  },
  {
    id: "CWE-359",
    name: "Privacy Violation",
    keywords: ["privacy", "pii", "personal", "data", "gdpr"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["privacy"],
  },

  // Resource Management
  {
    id: "CWE-400",
    name: "Uncontrolled Resource Consumption",
    keywords: ["dos", "resource", "consumption", "exhaustion", "memory"],
    strideCategories: ["DENIAL_OF_SERVICE"],
    severity: "MEDIUM",
    tags: ["dos"],
  },
  {
    id: "CWE-770",
    name: "Allocation Without Limits",
    keywords: ["allocation", "limit", "memory", "unbounded", "dos"],
    strideCategories: ["DENIAL_OF_SERVICE"],
    severity: "MEDIUM",
    tags: ["dos"],
  },
  {
    id: "CWE-502",
    name: "Deserialization of Untrusted Data",
    keywords: ["deserialization", "pickle", "yaml", "java", "rce"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "CRITICAL",
    tags: ["serialization"],
  },
  {
    id: "CWE-776",
    name: "XML Entity Expansion",
    keywords: ["xml", "bomb", "billion", "laughs", "entity", "expansion"],
    strideCategories: ["DENIAL_OF_SERVICE"],
    severity: "MEDIUM",
    tags: ["dos", "xml"],
  },

  // Logging
  {
    id: "CWE-778",
    name: "Insufficient Logging",
    keywords: ["logging", "audit", "insufficient", "missing", "trail"],
    strideCategories: ["REPUDIATION"],
    severity: "MEDIUM",
    tags: ["logging"],
  },
  {
    id: "CWE-117",
    name: "Log Injection",
    keywords: ["log", "injection", "forge", "crlf", "newline"],
    strideCategories: ["REPUDIATION"],
    severity: "MEDIUM",
    tags: ["logging", "injection"],
  },
];

/**
 * CAPEC Index (subset of ~50 attack patterns)
 * Full list: https://capec.mitre.org/
 */
export const capecIndex: ThreatIndexEntry[] = [
  // Social Engineering
  {
    id: "CAPEC-98",
    name: "Phishing",
    keywords: ["phishing", "email", "social", "engineering", "spear"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["social-engineering"],
  },
  {
    id: "CAPEC-163",
    name: "Spear Phishing",
    keywords: ["spear", "phishing", "targeted", "executive", "whaling"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["social-engineering"],
  },
  {
    id: "CAPEC-151",
    name: "Identity Spoofing",
    keywords: ["identity", "spoofing", "impersonation", "pretexting"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["social-engineering"],
  },

  // Injection
  {
    id: "CAPEC-66",
    name: "SQL Injection",
    keywords: ["sql", "injection", "database", "query"],
    strideCategories: ["TAMPERING"],
    severity: "CRITICAL",
    tags: ["injection"],
  },
  {
    id: "CAPEC-86",
    name: "XSS via HTTP Headers",
    keywords: ["xss", "header", "injection", "script"],
    strideCategories: ["TAMPERING"],
    severity: "HIGH",
    tags: ["injection", "web"],
  },
  {
    id: "CAPEC-88",
    name: "OS Command Injection",
    keywords: ["command", "os", "shell", "injection"],
    strideCategories: ["TAMPERING"],
    severity: "CRITICAL",
    tags: ["injection"],
  },
  {
    id: "CAPEC-136",
    name: "LDAP Injection",
    keywords: ["ldap", "injection", "directory", "query"],
    strideCategories: ["TAMPERING"],
    severity: "HIGH",
    tags: ["injection"],
  },

  // Authentication
  {
    id: "CAPEC-49",
    name: "Password Brute Forcing",
    keywords: ["brute", "force", "password", "credential"],
    strideCategories: ["SPOOFING"],
    severity: "MEDIUM",
    tags: ["authentication"],
  },
  {
    id: "CAPEC-55",
    name: "Rainbow Table Password Cracking",
    keywords: ["rainbow", "table", "hash", "crack", "password"],
    strideCategories: ["SPOOFING"],
    severity: "MEDIUM",
    tags: ["authentication"],
  },
  {
    id: "CAPEC-60",
    name: "Reusing Session IDs",
    keywords: ["session", "reuse", "hijack", "fixation"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["session"],
  },
  {
    id: "CAPEC-61",
    name: "Session Fixation",
    keywords: ["session", "fixation", "set", "token"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["session"],
  },

  // Authorization
  {
    id: "CAPEC-122",
    name: "Privilege Abuse",
    keywords: ["privilege", "abuse", "escalation", "admin"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    tags: ["authorization"],
  },
  {
    id: "CAPEC-233",
    name: "Privilege Escalation",
    keywords: ["privilege", "escalation", "elevation", "root"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "CRITICAL",
    tags: ["authorization"],
  },
  {
    id: "CAPEC-17",
    name: "Exploiting Trust",
    keywords: ["trust", "exploit", "relationship", "boundary"],
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    tags: ["authorization"],
  },

  // Network
  {
    id: "CAPEC-94",
    name: "Man in the Middle",
    keywords: ["mitm", "man", "middle", "intercept"],
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    tags: ["network"],
  },
  {
    id: "CAPEC-157",
    name: "Sniffing Network Traffic",
    keywords: ["sniff", "capture", "network", "traffic", "wireshark"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "MEDIUM",
    tags: ["network"],
  },
  {
    id: "CAPEC-125",
    name: "Flooding",
    keywords: ["flood", "dos", "ddos", "bandwidth"],
    strideCategories: ["DENIAL_OF_SERVICE"],
    severity: "HIGH",
    tags: ["dos", "network"],
  },

  // Application
  {
    id: "CAPEC-126",
    name: "Path Traversal",
    keywords: ["path", "traversal", "directory", "lfi", "file"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["file"],
  },
  {
    id: "CAPEC-664",
    name: "Server Side Request Forgery",
    keywords: ["ssrf", "server", "request", "forgery"],
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    tags: ["network"],
  },
  {
    id: "CAPEC-586",
    name: "Object Injection",
    keywords: ["object", "injection", "deserialization", "unserialize"],
    strideCategories: ["TAMPERING"],
    severity: "CRITICAL",
    tags: ["injection"],
  },
];

/** Get base URL for external source detail pages */
export function getExternalDetailUrl(source: string, id: string): string {
  switch (source) {
    case "MITRE_ATTACK":
      return `https://attack.mitre.org/techniques/${id.replace(".", "/")}/`;
    case "CWE":
      return `https://cwe.mitre.org/data/definitions/${id.replace("CWE-", "")}.html`;
    case "CAPEC":
      return `https://capec.mitre.org/data/definitions/${id.replace("CAPEC-", "")}.html`;
    default:
      return "";
  }
}
