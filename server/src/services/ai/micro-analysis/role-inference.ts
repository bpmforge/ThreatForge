/**
 * Security-role inference for components whose canvas type carries no reference data.
 *
 * The problem: reference tables (CWE_BY_COMPONENT and friends) are keyed by
 * SECURITY ROLE — AUTH_SERVICE, DATABASE, API, WEB_APP, OBJECT_STORAGE — while
 * the canvas records what the user DREW. Someone modelling an authentication
 * service as a MICROSERVICE gets no auth reference data at all, so the prompt
 * never sees CWE-916 (Weak Password Hashing) for a component whose declared
 * dataTypes are password hashes.
 *
 * Refusing to guess loses real coverage. Guessing silently is worse: an
 * inferred role changes which weaknesses the model is shown, and a wrong
 * inference quietly points the analysis at the wrong threat class. So this
 * infers, and every inference is returned as a reviewable record — never
 * applied invisibly.
 *
 * Three rules:
 *
 *   1. Only fills a gap. A component whose declared type already has reference
 *      data is left alone; inference never overrides an explicit choice.
 *   2. Evidence is recorded, not just a verdict. Each inference says which
 *      signals fired, so a reviewer can judge it without re-deriving it.
 *   3. Confidence gates review, not application. A LOW-confidence inference is
 *      still used — coverage is the point — but is flagged `needsReview`, so a
 *      guess is visible as a guess to the engineer and to security review.
 */

/** Roles that have reference data worth routing to. */
type SecurityRole =
  | "AUTH_SERVICE"
  | "DATABASE"
  | "API"
  | "WEB_APP"
  | "OBJECT_STORAGE";

export interface RoleInference {
  componentId: string;
  componentName: string;
  /** What the canvas said. */
  declaredType: string;
  /** What the evidence suggests. */
  inferredRole: SecurityRole;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  /** Which signals fired, in human-readable form. */
  evidence: string[];
  /** True unless confidence is HIGH — surface these for a human decision. */
  needsReview: boolean;
}

/** Component fields this needs. Structural, so callers stay decoupled. */
export interface InferenceInput {
  id: string;
  name: string;
  type: string;
  description?: string;
  dataTypes: string[];
  technologyVersion?: string;
}

/**
 * Canvas types that already resolve to reference data. Inference is skipped for
 * these — an explicit choice outranks a guess.
 */
const TYPES_WITH_REFERENCE_DATA = new Set([
  "DATABASE",
  "API",
  "WEB_APP",
  "AUTH_SERVICE",
  "OBJECT_STORAGE",
]);

/**
 * Types that are never inferred FOR, whatever their description says.
 *
 * An ACTOR is a person and an EXTERNAL_ENTITY is a third party we do not
 * implement; our reference tables describe weaknesses in software we build, so
 * routing either to a software role mislabels the whole analysis. This is not
 * hypothetical: the go-forward "End User" is an ACTOR described as "customer
 * using a browser" carrying "session cookies", which scored WEB_APP at HIGH
 * confidence — a wrong inference that, being HIGH, would have been applied
 * without even raising the review flag.
 */
const NEVER_INFER_FOR = new Set(["ACTOR", "EXTERNAL_ENTITY", "EXTERNAL_USER"]);

/**
 * Signals per role. `strong` terms name the role's function directly; `weak`
 * terms are consistent with it but also with other roles, so they cannot carry
 * an inference alone.
 */
const SIGNALS: Record<
  SecurityRole,
  { strong: RegExp; weak: RegExp; dataTypes: RegExp }
> = {
  AUTH_SERVICE: {
    strong:
      /\bauth(entication|orization)?\b|\bidentity\b|\bsso\b|\boauth\b|\boidc\b|\blogin\b/i,
    weak: /\btoken\b|\bsession\b|\bcredential\b|\bjwt\b/i,
    dataTypes: /password|credential|mfa|totp|refresh token|private key/i,
  },
  DATABASE: {
    strong:
      /\bdatabase\b|\bpostgres|\bmysql|\bmariadb|\boracle\b|\bsql server/i,
    weak: /\bpersist|\bstore\b|\brecords?\b|\bschema\b/i,
    dataTypes: /\brecords?\b|\brows?\b|\btables?\b/i,
  },
  WEB_APP: {
    strong:
      /\bweb app|\bfrontend\b|\bstorefront\b|\bportal\b|\bbrowser\b|\bspa\b/i,
    weak: /\bnext\.js|\breact\b|\bvue\b|\bangular\b|\bui\b/i,
    dataTypes: /cart|form input|session cookie/i,
  },
  API: {
    strong: /\brest api\b|\bgraphql\b|\bapi server\b|\bendpoint\b/i,
    weak: /\bfastify\b|\bexpress\b|\brequest\b|\brouting\b/i,
    dataTypes: /\brequests?\b|\bpayloads?\b/i,
  },
  OBJECT_STORAGE: {
    strong: /\bobject storage\b|\bs3\b|\bblob storage\b|\bbucket\b|\bgcs\b/i,
    weak: /\bupload\b|\bfiles?\b|\bassets?\b/i,
    dataTypes: /\bfiles?\b|\bdocuments?\b|\battachments?\b/i,
  },
};

/**
 * Infer a security role, or return null when the declared type already has
 * reference data or nothing fires.
 *
 * Confidence:
 *   HIGH   — a strong term AND a corroborating dataType signal
 *   MEDIUM — a strong term alone
 *   LOW    — only weak terms (used, but flagged for review)
 *
 * Deliberately conservative: an ambiguous component scores LOW and gets
 * surfaced rather than being silently routed to a role that reshapes its whole
 * threat analysis.
 */
export function inferSecurityRole(
  component: InferenceInput,
): RoleInference | null {
  const declared = component.type.toUpperCase();
  if (TYPES_WITH_REFERENCE_DATA.has(declared)) return null;
  if (NEVER_INFER_FOR.has(declared)) return null;

  const haystack = [component.name, component.description ?? ""].join(" ");
  const dataBlob = component.dataTypes.join(" ");

  let best: {
    role: SecurityRole;
    score: number;
    evidence: string[];
    strong: boolean;
    data: boolean;
  } | null = null;

  for (const [role, sig] of Object.entries(SIGNALS) as Array<
    [SecurityRole, (typeof SIGNALS)[SecurityRole]]
  >) {
    const strong = haystack.match(sig.strong);
    const weak = haystack.match(sig.weak);

    // A data type CORROBORATES a role; it can never establish one. "order
    // records" on an Order Service would otherwise infer DATABASE, which is
    // wrong and would reshape that component's whole analysis. So an inference
    // requires the name or description to say what the thing IS.
    if (!strong && !weak) continue;

    const data = dataBlob.match(sig.dataTypes);
    const evidence: string[] = [];
    if (strong) evidence.push(`name/description mentions "${strong[0]}"`);
    if (data) evidence.push(`data type "${data[0]}"`);
    if (weak && !strong) evidence.push(`mentions "${weak[0]}"`);

    const score = (strong ? 4 : 0) + (data ? 2 : 0) + (weak ? 1 : 0);
    if (!best || score > best.score) {
      best = {
        role,
        score,
        evidence,
        strong: Boolean(strong),
        data: Boolean(data),
      };
    }
  }

  if (!best) return null;

  //   HIGH   — the component says what it is AND its data agrees
  //   MEDIUM — it says what it is, with nothing corroborating
  //   LOW    — only an incidental term fired; used, but surfaced for review
  const confidence = best.strong ? (best.data ? "HIGH" : "MEDIUM") : "LOW";

  return {
    componentId: component.id,
    componentName: component.name,
    declaredType: component.type,
    inferredRole: best.role,
    confidence,
    evidence: best.evidence,
    needsReview: confidence !== "HIGH",
  };
}

/**
 * One-line summary per inference, for the job log and the completion summary.
 * Reads as a question a human can answer, not as a decision already made.
 */
export function describeInference(i: RoleInference): string {
  const mark = i.needsReview ? "REVIEW" : "ok";
  return `[${mark}] ${i.componentName} is drawn as ${i.declaredType}; analysed as ${i.inferredRole} (${i.confidence}) — ${i.evidence.join("; ")}`;
}
