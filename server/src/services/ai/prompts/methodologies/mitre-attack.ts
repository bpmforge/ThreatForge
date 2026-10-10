/**
 * MITRE ATT&CK Methodology Integration
 *
 * Maps threats to MITRE ATT&CK techniques and provides structured
 * technique-to-mitigation mapping for enterprise environments.
 *
 * Focused on the most relevant ATT&CK tactics for application threat modeling:
 * - Initial Access (TA0001)
 * - Execution (TA0002)
 * - Persistence (TA0003)
 * - Privilege Escalation (TA0004)
 * - Defense Evasion (TA0005)
 * - Credential Access (TA0006)
 * - Discovery (TA0007)
 * - Lateral Movement (TA0008)
 * - Collection (TA0009)
 * - Exfiltration (TA0010)
 * - Impact (TA0040)
 */

export const MITRE_ATTACK_SYSTEM_PROMPT = `You are a threat intelligence analyst who maps system vulnerabilities to the MITRE ATT&CK framework. You identify specific ATT&CK techniques that apply to the system architecture and recommend corresponding mitigations.

## ATT&CK Tactics (use these exact values for category)
- INITIAL_ACCESS: How attackers get in (T1190 Exploit Public-Facing, T1078 Valid Accounts, T1195 Supply Chain)
- EXECUTION: How attackers run code (T1059 Command/Script, T1203 Exploitation for Client Execution)
- PERSISTENCE: How attackers maintain access (T1098 Account Manipulation, T1136 Create Account, T1053 Scheduled Task)
- PRIVILEGE_ESCALATION: How attackers gain higher access (T1068 Exploitation for Privilege Escalation, T1078 Valid Accounts)
- DEFENSE_EVASION: How attackers avoid detection (T1070 Indicator Removal, T1562 Impair Defenses)
- CREDENTIAL_ACCESS: How attackers steal credentials (T1110 Brute Force, T1528 Steal Application Access Token, T1552 Unsecured Credentials)
- DISCOVERY: How attackers learn the environment (T1046 Network Service Scanning, T1087 Account Discovery)
- LATERAL_MOVEMENT: How attackers spread (T1021 Remote Services, T1210 Exploitation of Remote Services)
- COLLECTION: How attackers gather target data (T1005 Data from Local System, T1039 Data from Network Shared Drive)
- EXFILTRATION: How attackers steal data (T1048 Exfiltration Over Alternative Protocol, T1567 Exfiltration Over Web Service)
- IMPACT: How attackers cause damage (T1485 Data Destruction, T1489 Service Stop, T1498 Network DoS)

## Analysis Approach
1. For each component, identify which ATT&CK techniques could target it
2. For each data flow, identify which techniques could exploit it
3. Map each threat to a specific ATT&CK technique ID (T####)
4. Recommend the corresponding ATT&CK mitigation (M####)
5. Consider the full attack chain across multiple tactics

## Technique ID Format
Always use the format "T####" or "T####.###" for sub-techniques.
Always use "M####" for mitigations.`;

export const MITRE_ATTACK_ANALYSIS_PROMPT = `Perform a MITRE ATT&CK technique mapping for this system architecture.

## System: {{systemName}}

## Components
{{components}}

## Data Flows
{{connections}}

## Trust Boundaries
{{boundaries}}

## ATT&CK Analysis Instructions

For each component and data flow, identify the most relevant ATT&CK techniques. Focus on:
1. **Initial Access vectors** — How could an attacker first get into this system?
2. **Lateral Movement paths** — Once in, how could they spread?
3. **Data Exfiltration routes** — How could they steal data?
4. **Impact scenarios** — How could they cause maximum damage?

Produce 6-10 threats, each mapped to a specific ATT&CK technique.

Return ONLY a JSON array:
\`\`\`json
[
  {
    "title": "Specific threat title referencing ATT&CK technique",
    "description": "How this technique applies to THIS specific system",
    "category": "INITIAL_ACCESS|EXECUTION|PERSISTENCE|PRIVILEGE_ESCALATION|DEFENSE_EVASION|CREDENTIAL_ACCESS|DISCOVERY|LATERAL_MOVEMENT|COLLECTION|EXFILTRATION|IMPACT",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "targetComponentId": "component-id",
    "attackVector": "Step-by-step using this ATT&CK technique",
    "prerequisites": "What must be true for this technique to work",
    "mitreAttackId": "T1190|T1078|T1195.002|etc",
    "mitreTactic": "TA0001|TA0002|etc",
    "mitreMitigationId": "M1036|M1030|etc",
    "mitigation": "Specific fix aligned with ATT&CK mitigation",
    "mitigationEffectiveness": 0.35-0.85,
    "residualRisk": "What risk remains",
    "detectionDataSource": "What telemetry detects this (e.g., Network Traffic, Process Monitoring)",
    "confidence": 0.0-1.0,
    "references": ["MITRE ATT&CK T####", "CWE-XXX"],
    "analysisType": "mitre_attack"
  }
]
\`\`\`

IMPORTANT: Every threat MUST have a valid mitreAttackId. Be specific to THIS architecture — don't list generic techniques that don't apply.`;

/** Supply Chain specific analysis prompt */
export const SUPPLY_CHAIN_ANALYSIS_PROMPT = `Analyze the supply chain attack surface for this system. Focus on third-party dependencies, SOUP/OTS components, and external integrations.

## System: {{systemName}}

## Components
{{components}}

## Dependencies (SOUP/OTS)
{{dependencies}}

## External Integrations
{{externalIntegrations}}

## Supply Chain Analysis Instructions

For each dependency and external integration:
1. What is the blast radius if this dependency is compromised?
2. Is there integrity verification (signatures, checksums, SBOMs)?
3. Are there known CVEs or security advisories?
4. What's the update/patching cadence?
5. Is there a fallback if this dependency becomes unavailable?

Produce 3-6 supply chain threats.

Return ONLY a JSON array:
\`\`\`json
[
  {
    "title": "Supply chain threat title",
    "description": "How a supply chain compromise affects this system",
    "category": "INITIAL_ACCESS",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "targetComponentId": "component-id or dependency name",
    "attackVector": "How the supply chain attack works",
    "prerequisites": "What the attacker needs to compromise the supply chain",
    "mitreAttackId": "T1195|T1195.001|T1195.002",
    "dependencyName": "Name of the affected dependency",
    "blastRadius": "What systems are affected if this dependency is compromised",
    "mitigation": "Specific supply chain security controls",
    "mitigationEffectiveness": 0.35-0.75,
    "residualRisk": "What risk remains",
    "confidence": 0.0-1.0,
    "references": ["MITRE ATT&CK T1195", "CWE-829", "SLSA Level"],
    "analysisType": "supply_chain"
  }
]
\`\`\``;

/** ML/AI specific threat analysis prompt */
export const ML_THREAT_ANALYSIS_PROMPT = `Analyze the machine learning and AI-specific attack surface for this system.

## System: {{systemName}}

## ML/AI Components
{{mlComponents}}

## Data Flows to/from ML Components
{{mlDataFlows}}

## ML/AI Threat Analysis Instructions

For each ML component:
1. **Training Data Poisoning** — Can an attacker influence training data?
2. **Model Evasion** — Can adversarial inputs cause wrong predictions?
3. **Model Extraction** — Can the model be stolen via query access?
4. **Data Leakage** — Does the model memorize and leak training data?
5. **Model Supply Chain** — Are pre-trained models or transfer learning used?
6. **Inference Manipulation** — Can outputs be manipulated to cause real-world harm?

Produce 3-5 ML-specific threats.

Return ONLY a JSON array:
\`\`\`json
[
  {
    "title": "ML-specific threat title",
    "description": "How this ML attack works against THIS system",
    "category": "INITIAL_ACCESS|IMPACT|COLLECTION|DEFENSE_EVASION",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "targetComponentId": "ml-component-id",
    "attackVector": "Step-by-step ML attack",
    "prerequisites": "Access level needed (query access, training pipeline access, etc.)",
    "mlAttackType": "poisoning|evasion|extraction|inversion|supply_chain|manipulation",
    "realWorldImpact": "What happens in the physical world if this ML model is compromised",
    "mitigation": "ML-specific security control",
    "mitigationEffectiveness": 0.25-0.65,
    "residualRisk": "ML attacks are inherently hard to fully mitigate",
    "confidence": 0.0-1.0,
    "references": ["MITRE ATLAS ML####", "CWE-XXX"],
    "analysisType": "ml_threat"
  }
]
\`\`\`

IMPORTANT: ML mitigations are typically less effective (0.25-0.65) because adversarial ML is an active research area. Be honest about residual risk.`;
