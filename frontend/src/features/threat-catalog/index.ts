/**
 * Threat Catalog Feature - Public API
 *
 * Provides federated search across built-in library and external sources
 * (MITRE ATT&CK, CWE, CAPEC).
 */

// Components
export { ThreatCatalogDialog } from "./components/ThreatCatalogDialog";
export { IndexManagementPanel } from "./components/IndexManagementPanel";
export { CustomSourceImport } from "./components/CustomSourceImport";

// Hooks

// Services
export { getCatalogStats } from "./services/catalog-search";

// Data
export { builtInThreats, builtInStats } from "./data";
export { strideCoreThreats } from "./data/stride-core";
export { owaspEssentialThreats } from "./data/owasp-essentials";
export { cloudThreats } from "./data/cloud-threats";

// Types
export type { CatalogThreat } from "./types";
