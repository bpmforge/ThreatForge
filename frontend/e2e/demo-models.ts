/**
 * The five models the demo account (demo-tour@threatforge.local) must hold.
 * The smoke suite asserts them; the reseed-demo project restores them.
 * Names are matched by substring, so a richer imported model such as
 * "GreenSpot Services — SRS import" still satisfies the check.
 */
export const EXPECTED_DEMO_MODELS = [
  "Sample Threat Model",
  "Online Checkout",
  "GreenSpot Services",
  "OWASP Juice Shop",
  "Web App Template",
];

/** The public host. Account-wiping helpers refuse to run here by default. */
export const PUBLIC_HOST = "threatforge.bpmforge.com";
