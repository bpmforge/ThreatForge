/**
 * Public API for the citation verifier feature.
 *
 * Consumers (extraction-agent, micro-analysis pipeline, suggest/expert
 * paths) should import only from this module. Internal modules may evolve.
 */
export { computeRollup } from "./citation-verifier.js";
