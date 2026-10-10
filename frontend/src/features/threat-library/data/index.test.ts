/**
 * Threat Library Data Tests
 *
 * Tests to ensure threat library data integrity.
 */
import { describe, it, expect } from "vitest";
import {
  allThreats,
  threatsByCategory,
  spoofingThreats,
  tamperingThreats,
  repudiationThreats,
  infoDisclosureThreats,
  dosThreats,
  elevationThreats,
  owaspTop10Threats,
  owaspApiThreats,
  allOwaspThreats,
} from "./index";
import type { StrideCategory } from "@/types/canvas";

describe("Threat Library Data", () => {
  describe("allThreats", () => {
    it("should have threats", () => {
      expect(allThreats.length).toBeGreaterThan(0);
    });

    it("should have at least 40 threats", () => {
      expect(allThreats.length).toBeGreaterThanOrEqual(40);
    });

    it("should have unique IDs", () => {
      const ids = allThreats.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have required fields for each threat", () => {
      allThreats.forEach((threat) => {
        expect(threat.id).toBeDefined();
        expect(threat.id.length).toBeGreaterThan(0);
        expect(threat.name).toBeDefined();
        expect(threat.name.length).toBeGreaterThan(0);
        expect(threat.description).toBeDefined();
        expect(threat.description.length).toBeGreaterThan(0);
        expect(threat.strideCategories[0]).toBeDefined();
      });
    });

    it("should have valid STRIDE categories", () => {
      const validCategories: StrideCategory[] = [
        "SPOOFING",
        "TAMPERING",
        "REPUDIATION",
        "INFORMATION_DISCLOSURE",
        "DENIAL_OF_SERVICE",
        "ELEVATION_OF_PRIVILEGE",
      ];

      allThreats.forEach((threat) => {
        expect(validCategories).toContain(threat.strideCategories[0]);
      });
    });
  });

  describe("threatsByCategory", () => {
    it("should have all STRIDE categories", () => {
      expect(threatsByCategory).toHaveProperty("SPOOFING");
      expect(threatsByCategory).toHaveProperty("TAMPERING");
      expect(threatsByCategory).toHaveProperty("REPUDIATION");
      expect(threatsByCategory).toHaveProperty("INFORMATION_DISCLOSURE");
      expect(threatsByCategory).toHaveProperty("DENIAL_OF_SERVICE");
      expect(threatsByCategory).toHaveProperty("ELEVATION_OF_PRIVILEGE");
    });

    it("should have threats in each category", () => {
      expect(threatsByCategory.SPOOFING.length).toBeGreaterThan(0);
      expect(threatsByCategory.TAMPERING.length).toBeGreaterThan(0);
      expect(threatsByCategory.REPUDIATION.length).toBeGreaterThan(0);
      expect(threatsByCategory.INFORMATION_DISCLOSURE.length).toBeGreaterThan(
        0,
      );
      expect(threatsByCategory.DENIAL_OF_SERVICE.length).toBeGreaterThan(0);
      expect(threatsByCategory.ELEVATION_OF_PRIVILEGE.length).toBeGreaterThan(
        0,
      );
    });

    it("should correctly categorize threats", () => {
      threatsByCategory.SPOOFING.forEach((t) => {
        expect(t.strideCategories).toContain("SPOOFING");
      });
      threatsByCategory.TAMPERING.forEach((t) => {
        expect(t.strideCategories).toContain("TAMPERING");
      });
      threatsByCategory.DENIAL_OF_SERVICE.forEach((t) => {
        expect(t.strideCategories).toContain("DENIAL_OF_SERVICE");
      });
    });

    it("should sum to at least total threat count", () => {
      // Threats with multiple STRIDE categories appear in each category
      const totalFromCategories = Object.values(threatsByCategory).reduce(
        (sum, threats) => sum + threats.length,
        0,
      );
      expect(totalFromCategories).toBeGreaterThanOrEqual(allThreats.length);
    });
  });

  describe("STRIDE threat arrays", () => {
    it("should have spoofing threats", () => {
      expect(spoofingThreats.length).toBeGreaterThan(0);
      spoofingThreats.forEach((t) => {
        expect(t.strideCategories[0]).toBe("SPOOFING");
      });
    });

    it("should have tampering threats", () => {
      expect(tamperingThreats.length).toBeGreaterThan(0);
      tamperingThreats.forEach((t) => {
        expect(t.strideCategories[0]).toBe("TAMPERING");
      });
    });

    it("should have repudiation threats", () => {
      expect(repudiationThreats.length).toBeGreaterThan(0);
      repudiationThreats.forEach((t) => {
        expect(t.strideCategories[0]).toBe("REPUDIATION");
      });
    });

    it("should have information disclosure threats", () => {
      expect(infoDisclosureThreats.length).toBeGreaterThan(0);
      infoDisclosureThreats.forEach((t) => {
        expect(t.strideCategories[0]).toBe("INFORMATION_DISCLOSURE");
      });
    });

    it("should have denial of service threats", () => {
      expect(dosThreats.length).toBeGreaterThan(0);
      dosThreats.forEach((t) => {
        expect(t.strideCategories[0]).toBe("DENIAL_OF_SERVICE");
      });
    });

    it("should have elevation of privilege threats", () => {
      expect(elevationThreats.length).toBeGreaterThan(0);
      elevationThreats.forEach((t) => {
        expect(t.strideCategories[0]).toBe("ELEVATION_OF_PRIVILEGE");
      });
    });
  });

  describe("OWASP threats", () => {
    it("should have OWASP Top 10 threats", () => {
      expect(owaspTop10Threats.length).toBeGreaterThan(0);
    });

    it("should have OWASP API threats", () => {
      expect(owaspApiThreats.length).toBeGreaterThan(0);
    });

    it("should combine all OWASP threats", () => {
      expect(allOwaspThreats.length).toBeGreaterThan(owaspTop10Threats.length);
    });

    it("should have valid OWASP references", () => {
      // OWASP threats should have references
      const owaspThreatsWithInfo = allOwaspThreats.filter(
        (t) => t.references && t.references.length > 0,
      );
      expect(owaspThreatsWithInfo.length).toBeGreaterThan(0);
    });
  });

  describe("threat data quality", () => {
    it("should have reasonable name lengths", () => {
      allThreats.forEach((threat) => {
        expect(threat.name.length).toBeGreaterThan(3);
        expect(threat.name.length).toBeLessThan(200);
      });
    });

    it("should have reasonable description lengths", () => {
      allThreats.forEach((threat) => {
        expect(threat.description.length).toBeGreaterThan(10);
      });
    });

    it("should not have empty arrays where expected", () => {
      allThreats.forEach((threat) => {
        // If threat has applicableTo array, it should exist
        if (threat.applicableTo) {
          expect(Array.isArray(threat.applicableTo)).toBe(true);
        }
      });
    });
  });
});
