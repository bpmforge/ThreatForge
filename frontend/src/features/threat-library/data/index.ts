/**
 * Threat library data - aggregated STRIDE, OWASP, and cloud threats.
 *
 * This now pulls from the new threat-catalog feature for a unified set
 * of ~59 curated built-in threats.
 */
import { spoofingThreats } from "./spoofing";
import { tamperingThreats } from "./tampering";
import { repudiationThreats } from "./repudiation";
import { infoDisclosureThreats } from "./info-disclosure";
import { dosThreats } from "./dos";
import { elevationThreats } from "./elevation";
import { owaspTop10Threats } from "./owasp-top10";
import { owaspTop10Part2Threats } from "./owasp-top10-part2";
import { owaspApiThreats } from "./owasp-api";
import { owaspApiPart2Threats } from "./owasp-api-part2";
import { aiMlThreats } from "./ai-ml";
import { linddunThreats } from "./linddun";
import type { LibraryThreat, ThreatsByCategory } from "../types";
import {
  builtInThreats,
  strideCoreThreats,
  owaspEssentialThreats,
  cloudThreats,
  builtInStats,
} from "@/features/threat-catalog";
import type { CatalogThreat } from "@/features/threat-catalog";

/** All OWASP threats combined (legacy) */
const allOwaspThreats = [
  ...owaspTop10Threats,
  ...owaspTop10Part2Threats,
  ...owaspApiThreats,
  ...owaspApiPart2Threats,
];

/** Convert CatalogThreat to LibraryThreat format */
function catalogToLibrary(threat: CatalogThreat): LibraryThreat {
  return {
    id: threat.id,
    name: threat.name,
    description: threat.description,
    strideCategories: threat.strideCategories,
    defaultSeverity: threat.severity,
    applicableTo: threat.applicableTo,
    attackScenarios: threat.attackScenarios,
    suggestedMitigations: threat.mitigations,
    references: threat.references?.map((r) => r.id),
  };
}

/** All threats in the library - now includes catalog threats + AI/ML threats */
export const allThreats: LibraryThreat[] = [
  ...builtInThreats.map(catalogToLibrary),
  ...aiMlThreats,
  ...linddunThreats,
];

/** Threats grouped by source */
export const threatsBySource = {
  stride: strideCoreThreats.map(catalogToLibrary),
  owasp: owaspEssentialThreats.map(catalogToLibrary),
  cloud: cloudThreats.map(catalogToLibrary),
  aiml: aiMlThreats,
  linddun: linddunThreats,
};

/** AI/ML threats export */

/** Quick stats */
export { builtInStats };

/** Helper to get threats by category - threats with multiple categories appear in each */
const groupByCategory = (threats: LibraryThreat[]): ThreatsByCategory => {
  const grouped: ThreatsByCategory = {
    SPOOFING: [],
    TAMPERING: [],
    REPUDIATION: [],
    INFORMATION_DISCLOSURE: [],
    DENIAL_OF_SERVICE: [],
    ELEVATION_OF_PRIVILEGE: [],
  };
  threats.forEach((t) => {
    t.strideCategories.forEach((cat) => grouped[cat].push(t));
  });
  return grouped;
};

/** Threats organized by STRIDE category */
export const threatsByCategory: ThreatsByCategory = groupByCategory(allThreats);

export {
  spoofingThreats,
  tamperingThreats,
  repudiationThreats,
  infoDisclosureThreats,
  dosThreats,
  elevationThreats,
  owaspTop10Threats,
  owaspApiThreats,
  allOwaspThreats,
};
