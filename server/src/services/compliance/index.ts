/**
 * Compliance Analysis Service
 *
 * Public API for compliance gap analysis.
 */

export {
  analyzeCompliance,
  generateGapReport,
  compareFrameworks,
} from "./compliance-service.js";

export {
  getFrameworkCategories,
  getFrameworkControls,
  getFrameworkDisplayName,
  getSupportedFrameworks,
} from "./frameworks/index.js";

export type { ComplianceFramework } from "./types.js";
