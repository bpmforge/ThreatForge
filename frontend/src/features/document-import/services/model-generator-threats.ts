import type {
  ExtractedBoundary,
  ExtractedComponent,
  ExtractedDataFlow,
  ExtractionSuggestedThreat,
} from "../types";
import type { StrideCategory } from "@/types/canvas";

export function generateSuggestedThreats(
  components: ExtractedComponent[],
  flows: ExtractedDataFlow[],
  boundaries?: ExtractedBoundary[],
): ExtractionSuggestedThreat[] {
  const threats: ExtractionSuggestedThreat[] = [];

  components.forEach((component) => {
    switch (component.type) {
      case "database":
        threats.push({
          componentId: component.id,
          strideCategory: "spoofing" as StrideCategory,
          title: "SQL Injection",
          description:
            "Database component is vulnerable to SQL injection attacks",
          likelihood: "high",
          impact: "high",
          source: "component-type",
        });
        break;
      case "api":
        threats.push({
          componentId: component.id,
          strideCategory: "tampering" as StrideCategory,
          title: "Authentication Bypass",
          description:
            "API component may be vulnerable to authentication bypass",
          likelihood: "medium",
          impact: "high",
          source: "component-type",
        });
        break;
      case "webServer":
        threats.push({
          componentId: component.id,
          strideCategory: "information-disclosure" as StrideCategory,
          title: "Cross-Site Scripting",
          description: "Web server component may be vulnerable to XSS attacks",
          likelihood: "medium",
          impact: "medium",
          source: "component-type",
        });
        break;
    }
  });

  flows.forEach((flow) => {
    if (!flow.encrypted) {
      threats.push({
        componentId: flow.sourceId,
        strideCategory: "elevation" as StrideCategory,
        title: "Data Exposure in Transit",
        description: `Unencrypted data flow from ${flow.sourceId} to ${flow.targetId}`,
        likelihood: "high",
        impact: "high",
        source: "data-flow",
      });
    }
  });

  if (boundaries?.length) {
    const componentToBoundary = new Map<string, string>();
    for (const b of boundaries) {
      for (const cid of b.componentIds || []) {
        componentToBoundary.set(cid, b.id);
      }
    }

    flows.forEach((flow) => {
      const srcBoundary = componentToBoundary.get(flow.sourceId);
      const tgtBoundary = componentToBoundary.get(flow.targetId);
      if (srcBoundary && tgtBoundary && srcBoundary !== tgtBoundary) {
        threats.push({
          componentId: flow.sourceId,
          strideCategory: "tampering" as StrideCategory,
          title: "Trust Boundary Crossing",
          description: `Data flow crosses trust boundary: ${flow.sourceId} → ${flow.targetId}. Requires validation, authentication, and encryption.`,
          likelihood: "high",
          impact: "high",
          source: "boundary-crossing",
        });
      }
    });
  }

  return threats;
}
