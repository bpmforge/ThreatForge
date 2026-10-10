# STRIDE Methodology Reference

STRIDE is a threat modeling methodology developed by Microsoft that categorizes security threats into six categories.

## Overview

| Category | Target | Question |
|----------|--------|----------|
| **S**poofing | Authentication | Can an attacker pretend to be someone else? |
| **T**ampering | Integrity | Can an attacker modify data they shouldn't? |
| **R**epudiation | Non-repudiation | Can an attacker deny their actions? |
| **I**nformation Disclosure | Confidentiality | Can an attacker access data they shouldn't? |
| **D**enial of Service | Availability | Can an attacker disrupt the system? |
| **E**levation of Privilege | Authorization | Can an attacker gain unauthorized access? |

---

## Spoofing

**Definition:** Pretending to be someone or something else.

**Security Property:** Authentication

### Common Examples

| Attack | Description |
|--------|-------------|
| Credential theft | Stealing usernames and passwords |
| Session hijacking | Taking over another user's session |
| Token forgery | Creating fake authentication tokens |
| IP spoofing | Faking source IP addresses |
| Email spoofing | Sending emails from fake addresses |
| Certificate spoofing | Using fake SSL/TLS certificates |

### Applicable Components

- Authentication services
- Login pages
- API endpoints
- User interfaces
- Network connections

### Common Mitigations

- Strong authentication mechanisms (MFA)
- Secure session management
- Certificate validation
- Token signing and validation
- IP allowlisting
- Anti-phishing measures

---

## Tampering

**Definition:** Modifying data or code without authorization.

**Security Property:** Integrity

### Common Examples

| Attack | Description |
|--------|-------------|
| SQL injection | Modifying database queries |
| Parameter tampering | Changing request parameters |
| Man-in-the-middle | Intercepting and modifying traffic |
| File modification | Altering files on disk |
| Memory corruption | Exploiting buffer overflows |
| Code injection | Inserting malicious code |

### Applicable Components

- Databases
- API endpoints
- File storage
- Configuration files
- Network connections
- Memory/processes

### Common Mitigations

- Input validation
- Parameterized queries
- Digital signatures
- Message authentication codes (MAC)
- TLS/encryption
- Access controls
- File integrity monitoring

---

## Repudiation

**Definition:** Claiming to not have performed an action.

**Security Property:** Non-repudiation

### Common Examples

| Attack | Description |
|--------|-------------|
| Log deletion | Removing evidence of actions |
| Timestamp manipulation | Changing when events occurred |
| False denial | Denying performed transactions |
| Audit trail gaps | Exploiting logging blind spots |
| Shared account abuse | Acting under another's identity |

### Applicable Components

- Logging systems
- Audit trails
- Transaction systems
- User accounts
- Administrative interfaces

### Common Mitigations

- Comprehensive audit logging
- Log integrity protection
- Digital signatures
- Timestamps from trusted sources
- Individual accountability (no shared accounts)
- Secure log storage
- Log forwarding/centralization

---

## Information Disclosure

**Definition:** Exposing information to unauthorized parties.

**Security Property:** Confidentiality

### Common Examples

| Attack | Description |
|--------|-------------|
| Data breach | Unauthorized access to sensitive data |
| Error message leakage | Revealing system details in errors |
| Path traversal | Accessing files outside allowed directories |
| Memory disclosure | Reading sensitive memory contents |
| Network sniffing | Intercepting unencrypted traffic |
| Side-channel attacks | Inferring data from timing/power/etc. |

### Applicable Components

- Databases
- API responses
- Error handling
- File storage
- Network communications
- Caches

### Common Mitigations

- Encryption at rest and in transit
- Access control lists
- Data classification
- Minimal error messages
- Secure coding practices
- Network segmentation
- Data masking/redaction

---

## Denial of Service

**Definition:** Disrupting availability of services.

**Security Property:** Availability

### Common Examples

| Attack | Description |
|--------|-------------|
| DDoS | Overwhelming with traffic |
| Resource exhaustion | Consuming CPU/memory/disk |
| Logic bombs | Triggering system crashes |
| Account lockout abuse | Locking legitimate users out |
| Algorithmic complexity | Exploiting O(n²) operations |
| Connection exhaustion | Using up connection pools |

### Applicable Components

- Web servers
- API endpoints
- Databases
- Network infrastructure
- Authentication systems
- Any public-facing service

### Common Mitigations

- Rate limiting
- Auto-scaling
- DDoS protection services
- Resource quotas
- Circuit breakers
- Load balancing
- Caching
- Input validation (prevent regex DoS)

---

## Elevation of Privilege

**Definition:** Gaining access beyond what is authorized.

**Security Property:** Authorization

### Common Examples

| Attack | Description |
|--------|-------------|
| Privilege escalation | Moving from user to admin |
| IDOR | Insecure Direct Object Reference |
| Broken access control | Bypassing permission checks |
| JWT manipulation | Modifying token claims |
| Role confusion | Exploiting role assignment flaws |
| Container escape | Breaking out of containers |

### Applicable Components

- Authorization systems
- Admin interfaces
- API endpoints
- File systems
- Container/VM boundaries
- Database access

### Common Mitigations

- Principle of least privilege
- Role-based access control (RBAC)
- Attribute-based access control (ABAC)
- Server-side authorization checks
- Secure defaults (deny by default)
- Privilege separation
- Regular access reviews

---

## STRIDE per Element

Different diagram elements are susceptible to different STRIDE categories:

### External Entities (Users/Systems)

| Category | Applicable | Notes |
|----------|------------|-------|
| Spoofing | ✅ Yes | Can be impersonated |
| Tampering | ❌ No | External to system |
| Repudiation | ✅ Yes | May deny actions |
| Info Disclosure | ❌ No | External to system |
| Denial of Service | ❌ No | External to system |
| Elevation of Privilege | ❌ No | External to system |

### Processes/Services

| Category | Applicable | Notes |
|----------|------------|-------|
| Spoofing | ✅ Yes | Can be impersonated |
| Tampering | ✅ Yes | Code/config can be modified |
| Repudiation | ✅ Yes | Actions may not be logged |
| Info Disclosure | ✅ Yes | May leak data |
| Denial of Service | ✅ Yes | Can be crashed/overloaded |
| Elevation of Privilege | ✅ Yes | May grant unauthorized access |

### Data Stores

| Category | Applicable | Notes |
|----------|------------|-------|
| Spoofing | ❌ No | Not applicable |
| Tampering | ✅ Yes | Data can be modified |
| Repudiation | ❌ No | Not applicable |
| Info Disclosure | ✅ Yes | Data can be leaked |
| Denial of Service | ✅ Yes | Can be unavailable |
| Elevation of Privilege | ❌ No | Not applicable |

### Data Flows

| Category | Applicable | Notes |
|----------|------------|-------|
| Spoofing | ❌ No | Not applicable |
| Tampering | ✅ Yes | Traffic can be modified |
| Repudiation | ❌ No | Not applicable |
| Info Disclosure | ✅ Yes | Traffic can be intercepted |
| Denial of Service | ✅ Yes | Traffic can be blocked |
| Elevation of Privilege | ❌ No | Not applicable |

---

## Using STRIDE in ThreatForge

### 1. Add Components to Canvas

Drag components from the palette to represent your system architecture.

### 2. Connect Components

Draw data flows between components to show how data moves.

### 3. Identify Threats

For each component and connection:
- Consider which STRIDE categories apply
- Use the threat library for common threats
- Use AI suggestions for automated analysis

### 4. Document Threats

For each threat:
- Assign one or more STRIDE categories
- Set severity level
- Link to affected component/connection
- Add CWE/OWASP references

### 5. Plan Mitigations

For each threat:
- Add mitigations with strategies
- Assign owners and due dates
- Track implementation status

---

## References

- [Microsoft STRIDE Documentation](https://docs.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats)
- [OWASP Threat Modeling](https://owasp.org/www-community/Threat_Modeling)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
