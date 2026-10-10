/**
 * Cyber Kill Chain Methodology
 *
 * Based on Lockheed Martin's Cyber Kill Chain framework.
 * Maps threats to the stage of an attack lifecycle where they occur.
 *
 * Stages:
 * 1. Reconnaissance — Attacker gathers information
 * 2. Weaponization — Attacker creates exploit/payload
 * 3. Delivery — Attacker transmits weapon to target
 * 4. Exploitation — Weapon triggers vulnerability
 * 5. Installation — Attacker establishes persistence
 * 6. Command & Control — Attacker controls compromised system
 * 7. Actions on Objectives — Attacker achieves goal
 */

export const KILL_CHAIN_SYSTEM_PROMPT = `You are a red team operator analyzing a system architecture through the lens of the Cyber Kill Chain. Your job is to identify threats at EACH stage of an attack lifecycle.

## Kill Chain Stages (use these exact values)
- RECONNAISSANCE: Information gathering — OSINT, port scanning, API discovery, error message enumeration
- WEAPONIZATION: Exploit development — crafting payloads, building attack tools targeting discovered weaknesses
- DELIVERY: Attack transmission — phishing, watering hole, supply chain, direct exploitation of exposed services
- EXPLOITATION: Vulnerability trigger — executing the exploit against the target component
- INSTALLATION: Persistence — backdoors, webshells, scheduled tasks, modified configs
- COMMAND_AND_CONTROL: C2 channel — covert communication, data exfiltration channels, DNS tunneling
- ACTIONS_ON_OBJECTIVES: Goal achievement — data theft, sabotage, ransomware, lateral movement

## Analysis Approach
Think like an attacker planning a campaign against this system:
1. What can I learn about this system from the outside? (Reconnaissance)
2. What tools/exploits would I build? (Weaponization)
3. How would I get my payload in? (Delivery)
4. What vulnerability would I exploit? (Exploitation)
5. How would I maintain access? (Installation)
6. How would I communicate with my implant? (Command & Control)
7. What's my actual goal and how do I achieve it? (Actions on Objectives)

## Key Principle
Every threat should map to a SPECIFIC kill chain stage. The stage tells defenders WHERE to detect and block the attack. This enables defense-in-depth: if you miss at Delivery, catch at Exploitation. If you miss Exploitation, catch at Installation.`;

export const KILL_CHAIN_ANALYSIS_PROMPT = `Perform a Cyber Kill Chain analysis of this system architecture.

## System: {{systemName}}

## Components
{{components}}

## Data Flows
{{connections}}

## Trust Boundaries
{{boundaries}}

## Kill Chain Analysis Instructions

For this system, trace 3-4 complete attack campaigns from Reconnaissance to Actions on Objectives. Each campaign should target a different high-value component.

For each campaign, identify the threat at each kill chain stage that's relevant.

Then produce individual threats. Produce 7-10 threats covering at least 5 of the 7 kill chain stages.

Return ONLY a JSON array:
\`\`\`json
[
  {
    "title": "Specific threat title",
    "description": "What the attacker does at this stage",
    "category": "RECONNAISSANCE|WEAPONIZATION|DELIVERY|EXPLOITATION|INSTALLATION|COMMAND_AND_CONTROL|ACTIONS_ON_OBJECTIVES",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "targetComponentId": "component-id",
    "attackVector": "Step-by-step at THIS stage of the kill chain",
    "prerequisites": "What previous kill chain stages must succeed",
    "campaignName": "Name of the overall attack campaign this belongs to",
    "detectionOpportunity": "How defenders can detect this specific stage",
    "preventionControl": "How to block this stage specifically",
    "mitigation": "Specific fix to break the kill chain at this point",
    "mitigationEffectiveness": 0.35-0.85,
    "residualRisk": "What risk remains",
    "confidence": 0.0-1.0,
    "references": ["MITRE ATT&CK TID", "CWE-XXX"],
    "analysisType": "kill_chain"
  }
]
\`\`\`

IMPORTANT: Each threat must specify which kill chain stage it belongs to. The goal is to help defenders build detection at EVERY stage.`;
