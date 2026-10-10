import { useState } from "react";
import type {
  OWASPRiskRatingMetrics,
  OWASPThreatAgentFactors,
  OWASPVulnerabilityFactors,
  OWASPTechnicalImpactFactors,
  OWASPBusinessImpactFactors,
  OWASPLikelihoodFactor,
} from "../../types/risk-frameworks";

export type FactorCategory =
  | "threatAgent"
  | "vulnerability"
  | "technicalImpact"
  | "businessImpact";

interface UseOWASPRiskHandlersProps {
  value: OWASPRiskRatingMetrics;
  onChange: (value: OWASPRiskRatingMetrics) => void;
}

export function useOWASPRiskHandlers({
  value,
  onChange,
}: UseOWASPRiskHandlersProps) {
  const [expandedSections, setExpandedSections] = useState<Set<FactorCategory>>(
    new Set(["threatAgent", "vulnerability"]),
  );

  const toggleSection = (section: FactorCategory) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleThreatAgentChange = (
    key: keyof OWASPThreatAgentFactors,
    val: number,
  ) => {
    onChange({
      ...value,
      threatAgentFactors: {
        ...value.threatAgentFactors,
        [key]: val as OWASPLikelihoodFactor,
      },
    });
  };

  const handleVulnerabilityChange = (
    key: keyof OWASPVulnerabilityFactors,
    val: number,
  ) => {
    onChange({
      ...value,
      vulnerabilityFactors: {
        ...value.vulnerabilityFactors,
        [key]: val as OWASPLikelihoodFactor,
      },
    });
  };

  const handleTechnicalImpactChange = (
    key: keyof OWASPTechnicalImpactFactors,
    val: number,
  ) => {
    onChange({
      ...value,
      technicalImpactFactors: {
        ...value.technicalImpactFactors,
        [key]: val as OWASPLikelihoodFactor,
      },
    });
  };

  const handleBusinessImpactChange = (
    key: keyof OWASPBusinessImpactFactors,
    val: number,
  ) => {
    onChange({
      ...value,
      businessImpactFactors: {
        ...value.businessImpactFactors,
        [key]: val as OWASPLikelihoodFactor,
      },
    });
  };

  return {
    expandedSections,
    toggleSection,
    handleThreatAgentChange,
    handleVulnerabilityChange,
    handleTechnicalImpactChange,
    handleBusinessImpactChange,
  };
}
