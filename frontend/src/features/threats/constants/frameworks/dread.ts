/**
 * DREAD Framework Constants
 */

export const DREAD_CATEGORIES = [
  {
    key: "damage",
    label: "Damage",
    short: "D",
    description: "How much damage will be caused?",
    guidance: "0=None, 5=Individual user data, 10=Complete system destruction",
  },
  {
    key: "reproducibility",
    label: "Reproducibility",
    short: "R",
    description: "How easy is it to reproduce?",
    guidance:
      "0=Very hard/impossible, 5=With some effort, 10=Easy and reliable",
  },
  {
    key: "exploitability",
    label: "Exploitability",
    short: "E",
    description: "How much work to exploit?",
    guidance: "0=Advanced skills, 5=Skilled attacker, 10=Script kiddie",
  },
  {
    key: "affectedUsers",
    label: "Affected Users",
    short: "A",
    description: "How many users affected?",
    guidance: "0=None, 5=Some users, 10=All users",
  },
  {
    key: "discoverability",
    label: "Discoverability",
    short: "D",
    description: "How easy to discover?",
    guidance: "0=Very hard, 5=Can be figured out, 10=Publicly known",
  },
] as const;

export const DEFAULT_DREAD_METRICS = {
  damage: 5 as const,
  reproducibility: 5 as const,
  exploitability: 5 as const,
  affectedUsers: 5 as const,
  discoverability: 5 as const,
};
