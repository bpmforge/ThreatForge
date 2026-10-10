/**
 * OWASP Risk Rating Framework Constants
 */

export const OWASP_THREAT_AGENT_FACTORS = [
  {
    key: "skillLevel",
    label: "Skill Level",
    description: "How technically skilled is this group of threat agents?",
    options: [
      { value: 1, label: "No technical skills" },
      { value: 3, label: "Some technical skills" },
      { value: 5, label: "Advanced computer user" },
      { value: 6, label: "Network and programming skills" },
      { value: 9, label: "Security penetration skills" },
    ],
  },
  {
    key: "motive",
    label: "Motive",
    description: "How motivated is this group of threat agents?",
    options: [
      { value: 1, label: "Low or no reward" },
      { value: 4, label: "Possible reward" },
      { value: 9, label: "High reward" },
    ],
  },
  {
    key: "opportunity",
    label: "Opportunity",
    description: "What resources and opportunities are required?",
    options: [
      { value: 0, label: "Full access or expensive resources required" },
      { value: 4, label: "Special access or resources required" },
      { value: 7, label: "Some access or resources required" },
      { value: 9, label: "No access or resources required" },
    ],
  },
  {
    key: "size",
    label: "Size",
    description: "How large is this group of threat agents?",
    options: [
      { value: 2, label: "Developers/sys admins" },
      { value: 4, label: "Intranet users" },
      { value: 5, label: "Partners" },
      { value: 6, label: "Authenticated users" },
      { value: 9, label: "Anonymous Internet users" },
    ],
  },
] as const;

export const OWASP_VULNERABILITY_FACTORS = [
  {
    key: "easeOfDiscovery",
    label: "Ease of Discovery",
    description: "How easy is it to discover this vulnerability?",
    options: [
      { value: 1, label: "Practically impossible" },
      { value: 3, label: "Difficult" },
      { value: 7, label: "Easy" },
      { value: 9, label: "Automated tools available" },
    ],
  },
  {
    key: "easeOfExploit",
    label: "Ease of Exploit",
    description: "How easy is it to exploit this vulnerability?",
    options: [
      { value: 1, label: "Theoretical" },
      { value: 3, label: "Difficult" },
      { value: 5, label: "Easy" },
      { value: 9, label: "Automated tools available" },
    ],
  },
  {
    key: "awareness",
    label: "Awareness",
    description: "How well known is this vulnerability?",
    options: [
      { value: 1, label: "Unknown" },
      { value: 4, label: "Hidden" },
      { value: 6, label: "Obvious" },
      { value: 9, label: "Public knowledge" },
    ],
  },
  {
    key: "intrusionDetection",
    label: "Intrusion Detection",
    description: "How likely is an exploit to be detected?",
    options: [
      { value: 1, label: "Active detection in application" },
      { value: 3, label: "Logged and reviewed" },
      { value: 8, label: "Logged without review" },
      { value: 9, label: "Not logged" },
    ],
  },
] as const;

export const OWASP_TECHNICAL_IMPACT_FACTORS = [
  {
    key: "lossOfConfidentiality",
    label: "Loss of Confidentiality",
    description: "How much data could be disclosed?",
    options: [
      { value: 2, label: "Minimal non-sensitive data" },
      { value: 6, label: "Minimal critical data" },
      { value: 6, label: "Extensive non-sensitive data" },
      { value: 7, label: "Extensive critical data" },
      { value: 9, label: "All data" },
    ],
  },
  {
    key: "lossOfIntegrity",
    label: "Loss of Integrity",
    description: "How much data could be corrupted?",
    options: [
      { value: 1, label: "Minimal slightly corrupt data" },
      { value: 3, label: "Minimal seriously corrupt data" },
      { value: 5, label: "Extensive slightly corrupt data" },
      { value: 7, label: "Extensive seriously corrupt data" },
      { value: 9, label: "All data totally corrupt" },
    ],
  },
  {
    key: "lossOfAvailability",
    label: "Loss of Availability",
    description: "How much service could be lost?",
    options: [
      { value: 1, label: "Minimal secondary services" },
      { value: 5, label: "Minimal primary services" },
      { value: 5, label: "Extensive secondary services" },
      { value: 7, label: "Extensive primary services" },
      { value: 9, label: "All services completely lost" },
    ],
  },
  {
    key: "lossOfAccountability",
    label: "Loss of Accountability",
    description: "Are the threat agents' actions traceable?",
    options: [
      { value: 1, label: "Fully traceable" },
      { value: 7, label: "Possibly traceable" },
      { value: 9, label: "Completely anonymous" },
    ],
  },
] as const;

export const OWASP_BUSINESS_IMPACT_FACTORS = [
  {
    key: "financialDamage",
    label: "Financial Damage",
    description: "How much financial damage will result?",
    options: [
      { value: 1, label: "Less than cost to fix" },
      { value: 3, label: "Minor effect on annual profit" },
      { value: 7, label: "Significant effect on annual profit" },
      { value: 9, label: "Bankruptcy" },
    ],
  },
  {
    key: "reputationDamage",
    label: "Reputation Damage",
    description: "Would an exploit result in reputation damage?",
    options: [
      { value: 1, label: "Minimal damage" },
      { value: 4, label: "Loss of major accounts" },
      { value: 5, label: "Loss of goodwill" },
      { value: 9, label: "Brand damage" },
    ],
  },
  {
    key: "nonCompliance",
    label: "Non-Compliance",
    description: "What exposure does non-compliance introduce?",
    options: [
      { value: 2, label: "Minor violation" },
      { value: 5, label: "Clear violation" },
      { value: 7, label: "High profile violation" },
    ],
  },
  {
    key: "privacyViolation",
    label: "Privacy Violation",
    description:
      "How much personally identifiable information could be disclosed?",
    options: [
      { value: 3, label: "One individual" },
      { value: 5, label: "Hundreds of people" },
      { value: 7, label: "Thousands of people" },
      { value: 9, label: "Millions of people" },
    ],
  },
] as const;

export const DEFAULT_OWASP_METRICS = {
  threatAgentFactors: {
    skillLevel: 5 as const,
    motive: 5 as const,
    opportunity: 5 as const,
    size: 5 as const,
  },
  vulnerabilityFactors: {
    easeOfDiscovery: 5 as const,
    easeOfExploit: 5 as const,
    awareness: 5 as const,
    intrusionDetection: 5 as const,
  },
  technicalImpactFactors: {
    lossOfConfidentiality: 5 as const,
    lossOfIntegrity: 5 as const,
    lossOfAvailability: 5 as const,
    lossOfAccountability: 5 as const,
  },
  businessImpactFactors: {
    financialDamage: 5 as const,
    reputationDamage: 5 as const,
    nonCompliance: 5 as const,
    privacyViolation: 5 as const,
  },
};
