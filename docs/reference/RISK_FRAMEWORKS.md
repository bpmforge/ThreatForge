# Risk Scoring Frameworks Reference

ThreatForge supports multiple industry-standard risk scoring frameworks for assessing threat severity.

## Overview

| Framework | Scale | Best For |
|-----------|-------|----------|
| CVSS 3.1 | 0.0-10.0 | Vulnerability severity |
| CVSS 4.0 | 0.0-10.0 | Modern vulnerability assessment |
| DREAD | 0-10 | Quick risk estimation |
| OWASP Risk Rating | 0-9 | Application security |
| CIA Triad | Low/Medium/High | Impact assessment |

---

## CVSS 3.1 (Common Vulnerability Scoring System)

The industry standard for vulnerability severity scoring.

### Base Metrics

#### Attack Vector (AV)

| Value | Score | Description |
|-------|-------|-------------|
| Network (N) | 0.85 | Remotely exploitable via network |
| Adjacent (A) | 0.62 | Exploitable from adjacent network |
| Local (L) | 0.55 | Requires local access |
| Physical (P) | 0.20 | Requires physical access |

#### Attack Complexity (AC)

| Value | Score | Description |
|-------|-------|-------------|
| Low (L) | 0.77 | No special conditions needed |
| High (H) | 0.44 | Requires specific conditions |

#### Privileges Required (PR)

| Value | Score (Unchanged) | Score (Changed) | Description |
|-------|-------------------|-----------------|-------------|
| None (N) | 0.85 | 0.85 | No privileges needed |
| Low (L) | 0.62 | 0.68 | Basic user privileges |
| High (H) | 0.27 | 0.50 | Admin/elevated privileges |

#### User Interaction (UI)

| Value | Score | Description |
|-------|-------|-------------|
| None (N) | 0.85 | No user interaction |
| Required (R) | 0.62 | User must take action |

#### Scope (S)

| Value | Description |
|-------|-------------|
| Unchanged (U) | Impact limited to vulnerable component |
| Changed (C) | Impact extends to other components |

#### Impact Metrics (CIA)

| Value | Score | Description |
|-------|-------|-------------|
| None (N) | 0.00 | No impact |
| Low (L) | 0.22 | Limited impact |
| High (H) | 0.56 | Serious impact |

### Score Calculation

```
ISS = 1 - [(1-C) × (1-I) × (1-A)]

If Scope Unchanged:
  Impact = 6.42 × ISS

If Scope Changed:
  Impact = 7.52 × (ISS-0.029) - 3.25 × (ISS-0.02)^15

Exploitability = 8.22 × AV × AC × PR × UI

If Impact <= 0:
  Base Score = 0
Else if Scope Unchanged:
  Base Score = Roundup(min[(Impact + Exploitability), 10])
Else:
  Base Score = Roundup(min[1.08 × (Impact + Exploitability), 10])
```

### Severity Ratings

| Score | Rating |
|-------|--------|
| 0.0 | None |
| 0.1 - 3.9 | Low |
| 4.0 - 6.9 | Medium |
| 7.0 - 8.9 | High |
| 9.0 - 10.0 | Critical |

---

## CVSS 4.0

The latest version with improved metrics and supplemental groups.

### Key Differences from 3.1

- **Attack Requirements (AT)** - Replaces Attack Complexity
- **Provider Urgency (U)** - Supplemental urgency indicator
- **Refined Impact Metrics** - Separate vulnerable/subsequent system impacts
- **Supplemental Metrics Group** - Additional context factors

### Base Metrics

#### Attack Vector (AV)
Same as CVSS 3.1: Network, Adjacent, Local, Physical

#### Attack Complexity (AC)
Same as CVSS 3.1: Low, High

#### Attack Requirements (AT) - New

| Value | Description |
|-------|-------------|
| None (N) | No specific deployment conditions |
| Present (P) | Requires specific conditions |

#### Privileges Required (PR)
Same as CVSS 3.1: None, Low, High

#### User Interaction (UI)
Enhanced values:
- None (N)
- Passive (P) - User interaction without explicit action
- Active (A) - User must explicitly interact

#### Impact Metrics

Separated into:
- **Vulnerable System**: VC, VI, VA
- **Subsequent System**: SC, SI, SA

### Supplemental Metrics

| Metric | Values | Description |
|--------|--------|-------------|
| Safety (S) | N/P | Physical safety concern |
| Automatable (AU) | N/Y | Can be automated |
| Recovery (R) | A/U/I | Recovery difficulty |
| Value Density (V) | D/C | Target value concentration |
| Vulnerability Response Effort (RE) | L/M/H | Remediation effort |
| Provider Urgency (U) | Clear/Green/Amber/Red | Vendor urgency rating |

---

## DREAD

A simpler risk assessment model for quick estimation.

### Factors

Each factor is scored 1-10:

#### Damage Potential (D)

| Score | Description |
|-------|-------------|
| 1-3 | Minor data disclosure |
| 4-6 | Individual user data exposure |
| 7-9 | Administrative data compromise |
| 10 | Complete system takeover |

#### Reproducibility (R)

| Score | Description |
|-------|-------------|
| 1-3 | Very difficult to reproduce |
| 4-6 | Requires specific conditions |
| 7-9 | Easy to reproduce |
| 10 | Always reproducible |

#### Exploitability (E)

| Score | Description |
|-------|-------------|
| 1-3 | Requires advanced skills |
| 4-6 | Requires intermediate skills |
| 7-9 | Requires basic skills |
| 10 | Automated tools available |

#### Affected Users (A)

| Score | Description |
|-------|-------------|
| 1-3 | < 10% of users |
| 4-6 | 10-50% of users |
| 7-9 | 50-90% of users |
| 10 | All users |

#### Discoverability (D)

| Score | Description |
|-------|-------------|
| 1-3 | Very difficult to discover |
| 4-6 | Requires insider knowledge |
| 7-9 | Easily discoverable |
| 10 | Publicly known |

### Calculation

```
DREAD Score = (D + R + E + A + D) / 5
```

### Rating

| Score | Risk Level |
|-------|------------|
| 1-3 | Low |
| 4-6 | Medium |
| 7-9 | High |
| 10 | Critical |

---

## OWASP Risk Rating Methodology

Comprehensive risk assessment for application security.

### Likelihood Factors

#### Threat Agent Factors

| Factor | Values (0-9) | Description |
|--------|--------------|-------------|
| Skill Level | 1-9 | Technical skills required |
| Motive | 1-9 | Motivation level |
| Opportunity | 1-9 | Access and resources |
| Size | 1-9 | Number of potential attackers |

#### Vulnerability Factors

| Factor | Values (0-9) | Description |
|--------|--------------|-------------|
| Ease of Discovery | 1-9 | How easy to find |
| Ease of Exploit | 1-9 | How easy to exploit |
| Awareness | 1-9 | How well known |
| Intrusion Detection | 1-9 | Likelihood of detection |

### Impact Factors

#### Technical Impact

| Factor | Values (0-9) | Description |
|--------|--------------|-------------|
| Loss of Confidentiality | 1-9 | Data exposure |
| Loss of Integrity | 1-9 | Data corruption |
| Loss of Availability | 1-9 | Service disruption |
| Loss of Accountability | 1-9 | Attribution loss |

#### Business Impact

| Factor | Values (0-9) | Description |
|--------|--------------|-------------|
| Financial Damage | 1-9 | Monetary loss |
| Reputation Damage | 1-9 | Brand damage |
| Non-Compliance | 1-9 | Regulatory impact |
| Privacy Violation | 1-9 | Privacy breach |

### Calculation

```
Likelihood = (Threat Agent + Vulnerability) / 2
Impact = (Technical Impact + Business Impact) / 2
Risk = Likelihood × Impact / 9
```

### Risk Matrix

|  | Low Impact (0-3) | Medium Impact (3-6) | High Impact (6-9) |
|--|------------------|---------------------|-------------------|
| **High Likelihood (6-9)** | Medium | High | Critical |
| **Medium Likelihood (3-6)** | Low | Medium | High |
| **Low Likelihood (0-3)** | Note | Low | Medium |

---

## CIA Triad Impact Assessment

Simple impact-focused assessment based on security properties.

### Confidentiality Impact

| Level | Description |
|-------|-------------|
| None | No confidentiality impact |
| Low | Limited data exposure, minimal sensitivity |
| Medium | Moderate data exposure, internal data |
| High | Severe data exposure, sensitive/regulated data |

### Integrity Impact

| Level | Description |
|-------|-------------|
| None | No integrity impact |
| Low | Minor data modification, easily detected |
| Medium | Significant modification, some data loss |
| High | Critical data corruption, system compromise |

### Availability Impact

| Level | Description |
|-------|-------------|
| None | No availability impact |
| Low | Brief disruption, quick recovery |
| Medium | Extended disruption, degraded service |
| High | Complete service outage, data loss |

### Overall Impact Score

```
Overall = max(Confidentiality, Integrity, Availability)
```

Or weighted average based on data criticality:
```
Overall = (C × Wc + I × Wi + A × Wa) / (Wc + Wi + Wa)
```

---

## Choosing a Framework

### Use CVSS 3.1/4.0 When:
- Assessing technical vulnerabilities
- Need industry-standard scores
- Reporting to security teams
- Compliance requires CVSS

### Use DREAD When:
- Quick risk estimation needed
- Development team assessments
- Early design phase
- Less formal requirements

### Use OWASP Risk Rating When:
- Application security focus
- Business impact matters
- Need comprehensive assessment
- Web application threats

### Use CIA Triad When:
- Simple impact assessment
- Data classification focus
- Compliance mapping
- Non-technical stakeholders

---

## Using Risk Frameworks in ThreatForge

### 1. Configure Default Framework

Navigate to Organization Settings → Risk Scoring to set the default framework.

### 2. Score Individual Threats

In the Threat Panel, expand a threat and click "Risk Score" to:
- Select framework
- Enter factor values
- Calculate score automatically

### 3. View Risk Scores

Risk scores display as:
- Color-coded badges
- Numeric scores
- Rating labels (Critical, High, etc.)

### 4. Filter by Risk

Use the threat panel filters to:
- Sort by risk score
- Filter by rating
- Group by severity

### 5. Export Risk Data

Exports include:
- Framework used
- Factor values
- Calculated scores
- Rating labels
