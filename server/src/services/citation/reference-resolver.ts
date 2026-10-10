/**
 * REFERENCE citation resolver.
 *
 * Verifies citations like [ref:CWE-89], [ref:OWASP-A03:2021], [ref:NIST-SC-7]
 * by checking they match a recognised identifier format.
 *
 * Trade-off: format-only validation, NOT a database lookup. There
 * are ~1500 CWEs in MITRE — a full database would need to be bundled or
 * queried. Format check catches obvious fabrications (CWE-NOT_REAL,
 * A99:9999) without taking on that data dependency.
 *
 * If a citation in our curated STRIDE→CWE mapping is recognised, we return
 * VERIFIED with high confidence. Otherwise format-valid IDs return
 * VERIFIED with a "format-only" rationale; format-invalid IDs are PHANTOM.
 */

const CWE_FORMAT = /^CWE-\d+$/i;
const OWASP_FORMAT = /^A\d{2}:\d{4}$/i;
const NIST_800_53_FORMAT = /^[A-Z]{2}-\d+(?:\(\d+\))?$/;
const HIPAA_FORMAT = /^\d+(?:\.[a-z0-9]+)+$/i;
const ISO_FORMAT = /^A?\.?\d+(?:\.\d+)+$/;
const PCI_FORMAT = /^Req\.?\s?\d+(?:\.\d+)*$/i;

export interface ReferenceCheck {
  resolved: boolean;
  rationale: string;
  /** True iff the id is in our curated reference set (higher signal). */
  inCuratedSet?: boolean;
}

/**
 * Curated CWE list — the subset that the micro-analysis pipeline injects
 * into prompts. References to these get a stronger VERIFIED signal.
 * Source: STRIDE_TO_CWE in micro-analysis/reference-lookup.ts (kept in
 * sync manually — small list, low maintenance burden).
 */
const CURATED_CWES = new Set([
  "CWE-20",
  "CWE-79",
  "CWE-89",
  "CWE-94",
  "CWE-200",
  "CWE-209",
  "CWE-223",
  "CWE-250",
  "CWE-269",
  "CWE-287",
  "CWE-290",
  "CWE-295",
  "CWE-307",
  "CWE-311",
  "CWE-312",
  "CWE-319",
  "CWE-345",
  "CWE-346",
  "CWE-352",
  "CWE-384",
  "CWE-400",
  "CWE-407",
  "CWE-410",
  "CWE-532",
  "CWE-639",
  "CWE-770",
  "CWE-778",
  "CWE-779",
  "CWE-834",
  "CWE-862",
  "CWE-863",
  "CWE-918",
]);

/**
 * Curated OWASP Top-10 2021 IDs the micro-pipeline references.
 */
const CURATED_OWASP = new Set([
  "A01:2021",
  "A02:2021",
  "A03:2021",
  "A04:2021",
  "A05:2021",
  "A06:2021",
  "A07:2021",
  "A08:2021",
  "A09:2021",
  "A10:2021",
]);

export function checkReference(
  kind: string | undefined,
  id: string | undefined,
): ReferenceCheck {
  if (!id) {
    return { resolved: false, rationale: "no reference id supplied" };
  }

  const normalisedKind = (kind ?? inferKind(id)).toUpperCase();

  switch (normalisedKind) {
    case "CWE":
      return checkCwe(id);
    case "OWASP":
      return checkOwasp(id);
    case "NIST":
    case "NIST_800_53":
      return checkFormat(id, NIST_800_53_FORMAT, "NIST 800-53");
    case "HIPAA":
      return checkFormat(id, HIPAA_FORMAT, "HIPAA");
    case "ISO":
    case "ISO_27001":
      return checkFormat(id, ISO_FORMAT, "ISO 27001");
    case "PCI":
    case "PCI_DSS":
      return checkFormat(id, PCI_FORMAT, "PCI-DSS");
    default:
      return {
        resolved: false,
        rationale: `unknown reference kind "${kind ?? "unspecified"}"`,
      };
  }
}

function checkCwe(id: string): ReferenceCheck {
  if (!CWE_FORMAT.test(id)) {
    return {
      resolved: false,
      rationale: `not a valid CWE id (expected CWE-<number>)`,
    };
  }
  const upper = id.toUpperCase();
  if (CURATED_CWES.has(upper)) {
    return {
      resolved: true,
      inCuratedSet: true,
      rationale: "CWE recognised in curated STRIDE mapping",
    };
  }
  return {
    resolved: true,
    inCuratedSet: false,
    rationale:
      "CWE id has valid format (not in curated set — format-only check)",
  };
}

function checkOwasp(id: string): ReferenceCheck {
  if (!OWASP_FORMAT.test(id)) {
    return {
      resolved: false,
      rationale: "not a valid OWASP Top-10 id (expected A<NN>:<YYYY>)",
    };
  }
  const upper = id.toUpperCase();
  if (CURATED_OWASP.has(upper)) {
    return {
      resolved: true,
      inCuratedSet: true,
      rationale: "OWASP entry recognised in Top-10 2021",
    };
  }
  return {
    resolved: true,
    inCuratedSet: false,
    rationale: "OWASP id has valid format (not Top-10 2021)",
  };
}

function checkFormat(id: string, re: RegExp, label: string): ReferenceCheck {
  if (re.test(id)) {
    return { resolved: true, rationale: `${label} id has valid format` };
  }
  return { resolved: false, rationale: `not a valid ${label} id` };
}

/** Infer kind from id when caller didn't supply one. */
function inferKind(id: string): string {
  if (CWE_FORMAT.test(id)) return "CWE";
  if (OWASP_FORMAT.test(id)) return "OWASP";
  if (NIST_800_53_FORMAT.test(id)) return "NIST_800_53";
  if (HIPAA_FORMAT.test(id)) return "HIPAA";
  return "UNKNOWN";
}
