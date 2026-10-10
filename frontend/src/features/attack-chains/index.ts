/**
 * Attack Chains Feature — Public API
 *
 * The chains panel: list chains (name, severity → residual, status), expand to
 * hops, hop-hover highlights the path on the canvas, Accept/Reject status PATCH,
 * and an Analyze button that enqueues ATTACK_CHAIN_ANALYSIS with job-polling
 * progress. Visualization + API primitives are reused from features/attack-paths.
 */
export { AttackChainsPanel } from "./components/AttackChainsPanel";
