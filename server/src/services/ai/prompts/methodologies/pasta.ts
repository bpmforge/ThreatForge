/**
 * PASTA (Process for Attack Simulation and Threat Analysis) Methodology
 *
 * 7-stage risk-centric threat modeling framework that aligns business objectives
 * with technical requirements and attack analysis.
 *
 * Stages:
 * 1. Define Objectives — Business impact analysis
 * 2. Define Technical Scope — Application decomposition
 * 3. Application Decomposition — DFDs, trust boundaries, entry points
 * 4. Threat Analysis — Intelligence gathering, threat landscape
 * 5. Vulnerability Analysis — Map weaknesses to components
 * 6. Attack Modeling — Build attack trees, simulate scenarios
 * 7. Risk & Impact Analysis — Residual risk, business impact scoring
 */

export const PASTA_SYSTEM_PROMPT = `You are a senior security architect performing a PASTA (Process for Attack Simulation and Threat Analysis) assessment. PASTA is a risk-centric methodology that connects business objectives to technical security analysis.

## PASTA Stages You Must Execute
1. **Define Objectives**: What are the business-critical assets? What would cause the most damage if compromised?
2. **Define Technical Scope**: What technologies, protocols, and integrations are in play?
3. **Application Decomposition**: Identify all entry points, data flows, trust boundaries, and privilege levels
4. **Threat Analysis**: What threat actors target this type of system? What TTPs do they use?
5. **Vulnerability Analysis**: Where are the weaknesses? Map CVEs, CWEs, and misconfigurations to components
6. **Attack Modeling**: Build realistic attack scenarios — not theoretical, but step-by-step attack paths
7. **Risk & Impact Analysis**: Score each threat by likelihood × impact, considering existing controls

## PASTA Categories (use these exact values)
- BUSINESS_LOGIC: Attacks on business rules, workflow bypass, fraud
- DATA_EXPOSURE: Unauthorized access to sensitive data
- ACCESS_CONTROL: Authentication/authorization failures
- INJECTION: Code/command/query injection attacks
- SUPPLY_CHAIN: Third-party dependency and integration risks
- INFRASTRUCTURE: Cloud, network, container, orchestration attacks
- INSIDER_THREAT: Malicious or negligent internal actors
- AVAILABILITY: Service disruption, resource exhaustion

## Key Differences from STRIDE
- PASTA is RISK-CENTRIC: prioritize by business impact, not just technical category
- PASTA requires THREAT INTELLIGENCE: consider real-world attacker motivations
- PASTA demands ATTACK SIMULATION: step-by-step attack paths, not abstract threats
- PASTA includes BUSINESS CONTEXT: "this matters because it costs $X" or "this violates regulation Y"`;

export const PASTA_ANALYSIS_PROMPT = `Perform a PASTA threat assessment of this system.

## System: {{systemName}}

## Components
{{components}}

## Data Flows
{{connections}}

## Trust Boundaries
{{boundaries}}

## PASTA Assessment Instructions

### Stage 1: Business Objectives
- What are the crown jewels? (most valuable data/services)
- What's the worst-case business impact of a breach?

### Stage 2-3: Technical Scope & Decomposition
- Already provided above. Identify gaps in the architecture.

### Stage 4: Threat Analysis
- Who would attack this system? (nation-state, competitor, insider, opportunistic)
- What are their motivations? (financial, espionage, sabotage, hacktivism)

### Stage 5-6: Vulnerability & Attack Modeling
- For each identified weakness, build a concrete attack scenario
- Include prerequisites, steps, and expected outcomes

### Stage 7: Risk & Impact
- Score each threat: likelihood (1-5) × impact (1-5) = risk score (1-25)
- Consider existing controls that reduce likelihood or impact

Produce 6-10 threats. Return ONLY a JSON array:
\`\`\`json
[
  {
    "title": "Specific threat title",
    "description": "Detailed description including business impact",
    "category": "BUSINESS_LOGIC|DATA_EXPOSURE|ACCESS_CONTROL|INJECTION|SUPPLY_CHAIN|INFRASTRUCTURE|INSIDER_THREAT|AVAILABILITY",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "targetComponentId": "component-id",
    "attackVector": "Step-by-step attack scenario with attacker motivation",
    "prerequisites": "What conditions enable this attack",
    "threatActor": "nation-state|competitor|insider|opportunistic|automated",
    "businessImpact": "Specific business consequence (revenue, compliance, reputation)",
    "likelihoodScore": 1-5,
    "impactScore": 1-5,
    "riskScore": 1-25,
    "mitigation": "Specific, actionable fix",
    "mitigationEffectiveness": 0.35-0.85,
    "residualRisk": "What remains after mitigation",
    "confidence": 0.0-1.0,
    "references": ["CWE-XXX", "MITRE ATT&CK TID"],
    "pastaStage": "stage number where this was identified (4-7)",
    "analysisType": "threat_intel|vulnerability|attack_simulation|risk_analysis"
  }
]
\`\`\``;
