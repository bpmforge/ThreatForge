import { CredentialsSignin } from "next-auth";
import { internalBackendUrl } from "./backend-url";
import { clientIpHeaders } from "./client-ip";

/**
 * Codes the backend returns from POST /api/auth/credentials that the login
 * form shows a specific message for. Anything else is a plain failure.
 */
const FORM_CODES = new Set([
  "account_locked",
  "two_factor_required",
  "invalid_two_factor_code",
  "email_unverified",
  "account_disabled",
]);

/** Sign-in failure whose code reaches the login page as `?code=`. */
class SignInFailed extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

/**
 * Password sign-in. The backend checks the password, lockout, account status
 * and two-factor code, since only it can read two-factor secrets.
 */
export async function authorizeCredentials(
  credentials: Partial<Record<"email" | "password" | "code", unknown>>,
  request?: Request,
) {
  if (!credentials?.email || !credentials?.password) return null;

  let response: Response;
  try {
    response = await fetch(`${internalBackendUrl()}/api/auth/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...clientIpHeaders((name) => request?.headers.get(name)),
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
        code: credentials.code || undefined,
      }),
    });
  } catch (error) {
    console.error("Credentials check failed:", error);
    return null;
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof body?.code === "string" ? body.code : "";
    if (FORM_CODES.has(code)) throw new SignInFailed(code);
    return null;
  }

  const user = body?.data;
  if (!user?.id) return null;
  return {
    id: user.id as string,
    email: user.email as string,
    name: user.name as string | null,
    image: user.image as string | null,
  };
}
