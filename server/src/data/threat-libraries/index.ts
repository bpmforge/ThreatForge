/**
 * Threat Libraries Index
 *
 * Exports all predefined threat libraries for seeding.
 */

export type { ThreatTemplate } from "./cloud-threats.js";

import { CLOUD_LIBRARY } from "./cloud-threats.js";
import { CONTAINER_LIBRARY } from "./container-threats.js";
import { API_LIBRARY } from "./api-threats.js";

/**
 * All predefined threat libraries.
 */
const PREDEFINED_LIBRARIES = [CLOUD_LIBRARY, CONTAINER_LIBRARY, API_LIBRARY];

/**
 * Get all predefined threat templates as a flat list.
 */
function getAllPredefinedThreats() {
  return PREDEFINED_LIBRARIES.flatMap((lib) =>
    lib.templates.map((t) => ({
      ...t,
      library: lib.name,
    })),
  );
}

/**
 * Get threats by component type.
 */
export function getThreatsForComponentType(componentType: string) {
  return getAllPredefinedThreats().filter((t) =>
    t.applicableComponentTypes.some(
      (type) => type.toLowerCase() === componentType.toLowerCase(),
    ),
  );
}

/**
 * Get threats for a specific component type AND STRIDE category.
 */
export function getThreatsForComponentAndCategory(
  componentType: string,
  category: string,
) {
  return getAllPredefinedThreats().filter(
    (t) =>
      t.strideCategory === category &&
      t.applicableComponentTypes.some(
        (type) => type.toLowerCase() === componentType.toLowerCase(),
      ),
  );
}
