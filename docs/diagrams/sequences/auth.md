# ThreatForge — Authentication Sequence Diagrams

_Derived from `docs/sdlc/SEQUENCE_DIAGRAMS.md`. Covers credentials login, SSO/SAML, 2FA, password reset, email verification, and invitation accept._

---

## 1. Credentials Login

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant NextJS as Next.js Server
    participant AuthJS as Auth.js
    participant Fastify as Fastify API
    participant PG as PostgreSQL

    User->>Browser: Navigate to /login
    Browser->>NextJS: GET /login
    NextJS-->>Browser: Login page (SSR)

    User->>Browser: Enter email + password
    Browser->>NextJS: POST /api/auth/callback/credentials
    NextJS->>AuthJS: authorize(credentials)
    AuthJS->>Fastify: POST /api/auth-public/verify
    Fastify->>PG: SELECT user WHERE email = ?
    PG-->>Fastify: User record (hashed password)
    Fastify->>Fastify: bcrypt.compare(password, hash)

    alt Invalid credentials
        Fastify-->>AuthJS: 401 Unauthorized
        AuthJS-->>Browser: Redirect /login?error=CredentialsSignin
    else Account locked (10 failed attempts)
        Fastify-->>AuthJS: 429 Too Many Requests
        AuthJS-->>Browser: Redirect /login?error=AccountLocked
    else Valid credentials
        Fastify-->>AuthJS: 200 { id, email, name, orgId, role }
        AuthJS->>PG: INSERT Session (JWT cookie)
        AuthJS-->>Browser: Set-Cookie: authjs.session-token (HttpOnly, Secure)
        Browser->>NextJS: GET /dashboard (with session cookie)
        NextJS->>AuthJS: getSession()
        AuthJS-->>NextJS: Session { user, expires }
        NextJS-->>Browser: Dashboard (SSR with user context)
    end
```

---

## 2. SSO / SAML Login

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant NextJS as Next.js (Auth.js)
    participant BoxyHQ as BoxyHQ SAML Jackson
    participant IdP as Identity Provider (Okta/Azure AD)
    participant PG as PostgreSQL

    User->>Browser: Click "Sign in with SSO" on login page
    Browser->>NextJS: GET /api/auth/signin/saml?orgSlug=my-org
    NextJS->>BoxyHQ: GET SAML metadata for org slug
    BoxyHQ->>PG: SELECT SAML connection WHERE orgSlug = ?
    BoxyHQ-->>NextJS: SSO redirect URL + SAML request
    NextJS-->>Browser: 302 Redirect to IdP

    Browser->>IdP: SAML AuthnRequest (browser redirect)
    User->>IdP: Authenticate (if not already SSO session)
    IdP-->>Browser: SAML Response (browser POST to ACS URL)

    Browser->>NextJS: POST /api/auth/callback/saml (SAML assertion)
    NextJS->>BoxyHQ: POST /api/oauth/token (exchange SAML assertion for profile)
    BoxyHQ->>BoxyHQ: Validate SAML signature, extract attributes
    BoxyHQ-->>NextJS: { email, name, id (from IdP) }

    NextJS->>PG: SELECT User WHERE email = ?
    alt User not found (JIT provisioning)
        NextJS->>PG: INSERT User { email, name, status: ACTIVE, emailVerified: now }
        NextJS->>PG: INSERT Membership for org (if SSO org configured)
    end
    NextJS->>PG: INSERT Session
    NextJS-->>Browser: Set-Cookie: authjs.session-token
    Browser->>Browser: Redirect to /dashboard
```

---

## 3. Two-Factor Authentication Enrollment

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Fastify as Fastify API
    participant TOTP as TOTP Library
    participant PG as PostgreSQL
    participant AuthApp as Authenticator App

    User->>Browser: Settings → Security → Enable 2FA
    Browser->>Fastify: POST /api/users/me/two-factor/setup
    Fastify->>TOTP: generateSecret()
    Fastify->>TOTP: generateQrCode(secret, user.email)
    Fastify->>TOTP: generateBackupCodes(10)
    Fastify->>PG: UPDATE User SET twoFactorSecret = secret (NOT yet enabled)
    Fastify-->>Browser: 200 { qrCode (data URL), secret, backupCodes[] }

    Browser->>Browser: Display QR code
    User->>AuthApp: Scan QR code
    AuthApp-->>User: Shows 6-digit TOTP codes

    User->>Browser: Enter 6-digit code from app
    Browser->>Fastify: POST /api/users/me/two-factor/enable { code }
    Fastify->>PG: SELECT User.twoFactorSecret
    Fastify->>TOTP: verifyToken(code, secret)

    alt Invalid code
        TOTP-->>Fastify: false
        Fastify-->>Browser: 400 { error: "Invalid verification code" }
    else Valid code
        TOTP-->>Fastify: true
        Fastify->>PG: UPDATE User SET twoFactorEnabled = true, twoFactorVerifiedAt = now
        Fastify->>PG: INSERT AuditLog { action: ENABLE_2FA }
        Fastify-->>Browser: 200 { success: true }
        Browser->>Browser: Show "2FA enabled" confirmation + backup codes reminder
    end
```

---

## 4. Password Reset

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant NextJS as Next.js
    participant Fastify as Fastify API
    participant Email as Email Provider
    participant PG as PostgreSQL

    User->>Browser: Click "Forgot password?" on login page
    Browser->>Browser: Navigate to /forgot-password
    User->>Browser: Enter email address
    Browser->>Fastify: POST /api/auth-public/password-reset/request { email }
    Fastify->>PG: SELECT User WHERE email = ?
    Note right of Fastify: Always returns 200 regardless of whether email exists (prevents enumeration)
    alt User exists
        Fastify->>Fastify: Generate cryptographically random resetToken
        Fastify->>PG: UPDATE User SET resetToken = hash(token), resetTokenExpiry = now+1h
        Fastify->>Email: Send reset email with link /reset-password?token=xxx
    end
    Fastify-->>Browser: 200 { message: "If account exists, email sent" }

    User->>Email: Click reset link in email
    Browser->>NextJS: GET /reset-password?token=xxx
    NextJS-->>Browser: Reset password form

    User->>Browser: Enter new password + confirm
    Browser->>Fastify: POST /api/auth-public/password-reset/confirm { token, password }
    Fastify->>PG: SELECT User WHERE resetToken = hash(token) AND resetTokenExpiry > now
    alt Token invalid or expired
        Fastify-->>Browser: 400 { error: "Invalid or expired reset token" }
    else Valid token
        Fastify->>Fastify: Validate password strength
        Fastify->>PG: UPDATE User SET passwordHash = bcrypt(password), resetToken = null, failedLoginAttempts = 0
        Fastify->>PG: DELETE Sessions WHERE userId = user.id
        Fastify->>PG: INSERT AuditLog { action: PASSWORD_RESET }
        Fastify-->>Browser: 200 { message: "Password reset successful" }
        Browser->>Browser: Redirect to /login
    end
```

---

## 5. Email Verification

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant NextJS as Next.js
    participant Fastify as Fastify API
    participant Email as Email Provider
    participant PG as PostgreSQL

    Note over User, PG: Triggered on registration when requireEmailVerification = true

    Fastify->>Fastify: Generate verificationToken on user creation
    Fastify->>PG: INSERT User { status: PENDING_VERIFICATION, verificationToken, verificationTokenExpiry }
    Fastify->>Email: Send verification email with link /verify-email?token=xxx

    User->>Email: Click verification link
    Browser->>NextJS: GET /verify-email?token=xxx
    NextJS->>Fastify: POST /api/auth-public/email-verification/verify { token }
    Fastify->>PG: SELECT User WHERE verificationToken = token AND expiry > now
    alt Invalid or expired
        Fastify-->>Browser: 400 { error: "Invalid or expired verification token" }
        Browser->>Browser: Show "Resend verification email" option
    else Valid token
        Fastify->>PG: UPDATE User SET status = ACTIVE, emailVerified = now, verificationToken = null
        Fastify->>PG: INSERT AuditLog { action: EMAIL_VERIFIED }
        Fastify-->>Browser: 200 { message: "Email verified" }
        Browser->>Browser: Redirect to /dashboard (auto-login)
    end
```

---

## 6. Invitation Accept

```mermaid
sequenceDiagram
    actor Admin
    actor NewUser as New User
    participant Browser
    participant Fastify as Fastify API
    participant Email as Email Provider
    participant PG as PostgreSQL

    Admin->>Browser: Organisation settings → Invite member
    Browser->>Fastify: POST /api/organizations/:orgId/invitations { email, role }
    Fastify->>PG: SELECT User WHERE email = ?
    alt User already exists in platform
        Fastify->>PG: INSERT Membership { userId, orgId, role, status: PENDING }
        Fastify->>Email: Send invitation email with /invitations/:token/accept link
        Fastify-->>Browser: 200 { inviteLink, userExists: true }
    else New user
        Fastify->>PG: Store invitation record with token + expiry (7 days)
        Fastify->>Email: Send invitation with /register?inviteToken=xxx link
        Fastify-->>Browser: 200 { inviteLink, userExists: false }
    end

    NewUser->>Email: Click invitation link
    Browser->>NextJS: GET /invitations/:token (or /register?inviteToken=xxx)
    NextJS-->>Browser: Accept invitation page (or registration form)

    alt Existing user — accept directly
        NewUser->>Browser: Click "Accept Invitation" (logged in)
        Browser->>Fastify: POST /api/invitations/:token/accept
        Fastify->>PG: Validate token not expired
        Fastify->>PG: UPDATE Membership SET status = ACTIVE, acceptedAt = now
        Fastify->>PG: INSERT AuditLog { action: JOIN_ORGANIZATION }
        Fastify-->>Browser: 200 { organizationId, organizationName, role }
        Browser->>Browser: Redirect to org dashboard
    else New user — register then join
        NewUser->>Browser: Fill registration form + submit
        Browser->>Fastify: POST /api/auth-public/register { email, name, password, inviteToken }
        Fastify->>PG: INSERT User { status: ACTIVE } (email pre-verified via invite)
        Fastify->>PG: INSERT Membership { userId, orgId, role, status: ACTIVE }
        Fastify-->>Browser: 201 + auto-login → dashboard
    end
```
