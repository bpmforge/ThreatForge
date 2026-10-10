/**
 * Built-in Threat Catalog Data
 *
 * ~80 curated threats from:
 * - STRIDE core (30)
 * - OWASP essentials (15)
 * - Cloud threats (18)
 */
import type { CatalogThreat } from "../types";
import { strideCoreThreats } from "./stride-core";
import { owaspEssentialThreats } from "./owasp-essentials";
import { cloudThreats } from "./cloud-threats";

/** All built-in threats */
export const builtInThreats: CatalogThreat[] = [
  ...strideCoreThreats,
  ...owaspEssentialThreats,
  ...cloudThreats,
];

/** Quick stats about built-in library */
export const builtInStats = {
  total: builtInThreats.length,
  bySource: {
    stride: strideCoreThreats.length,
    owasp: owaspEssentialThreats.length,
    cloud: cloudThreats.length,
  },
  byCategory: {
    SPOOFING: builtInThreats.filter((t) =>
      t.strideCategories.includes("SPOOFING"),
    ).length,
    TAMPERING: builtInThreats.filter((t) =>
      t.strideCategories.includes("TAMPERING"),
    ).length,
    REPUDIATION: builtInThreats.filter((t) =>
      t.strideCategories.includes("REPUDIATION"),
    ).length,
    INFORMATION_DISCLOSURE: builtInThreats.filter((t) =>
      t.strideCategories.includes("INFORMATION_DISCLOSURE"),
    ).length,
    DENIAL_OF_SERVICE: builtInThreats.filter((t) =>
      t.strideCategories.includes("DENIAL_OF_SERVICE"),
    ).length,
    ELEVATION_OF_PRIVILEGE: builtInThreats.filter((t) =>
      t.strideCategories.includes("ELEVATION_OF_PRIVILEGE"),
    ).length,
  },
};

// CWE Database
