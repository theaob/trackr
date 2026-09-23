import prisma from "@/lib/db";
import { IdTokenClaims, verifyIdToken } from "@/lib/auth/oidc";
import { PUBLIC_USER_SELECT, SessionUser } from "@/lib/auth/publicUser";

export interface SsoConfigRecord {
  id: string;
  enabled: boolean;
  providerName: string;
  issuerUrl: string | null;
  clientId: string | null;
  clientSecret: string | null;
  certificate: string | null;
  allowSelfSignedCerts: boolean;
  autoProvisionUsers: boolean;
  trustUnverifiedEmails: boolean;
  defaultRole: string;
}

/**
 * Read the stored SSO configuration, creating a disabled placeholder row the
 * first time. SSO stays off until an administrator supplies key material.
 */
export async function loadSsoConfig(): Promise<SsoConfigRecord> {
  const existing = await prisma.ssoConfig.findUnique({ where: { id: "default" } });
  if (existing) return existing as SsoConfigRecord;

  return (await prisma.ssoConfig.create({
    data: { id: "default", enabled: false },
  })) as SsoConfigRecord;
}

/** True when the configuration can actually verify a token signature. */
export function ssoHasVerificationKey(config: SsoConfigRecord): boolean {
  return !!(config.certificate?.trim() || config.clientSecret?.trim());
}

export type SsoLoginResult =
  | { success: true; user: SessionUser }
  | { success: false; error: string; status: number };

/**
 * Exchange a signed ID token for a local user.
 *
 * Identity comes exclusively from verified token claims; nothing supplied
 * alongside the token by the caller is trusted.
 */
export async function loginWithIdToken(
  idToken: string,
  expectedNonce?: string | null
): Promise<SsoLoginResult> {
  const config = await loadSsoConfig();

  if (!config.enabled) {
    return { success: false, error: "SSO authentication is disabled.", status: 403 };
  }

  if (!ssoHasVerificationKey(config)) {
    return {
      success: false,
      error:
        "SSO is not configured: add the identity provider's X.509 certificate or client secret before signing in.",
      status: 503,
    };
  }

  const verification = verifyIdToken(idToken, {
    certificatePem: config.certificate,
    clientSecret: config.clientSecret,
    expectedIssuer: config.issuerUrl?.trim() || null,
    expectedAudience: config.clientId?.trim() || null,
    expectedNonce: expectedNonce || null,
  });

  if (!verification.valid) {
    return { success: false, error: verification.error, status: 401 };
  }

  return provisionFromClaims(verification.claims, config);
}

async function provisionFromClaims(
  claims: IdTokenClaims,
  config: SsoConfigRecord
): Promise<SsoLoginResult> {
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!email) {
    return {
      success: false,
      error: "The ID token does not contain an email claim.",
      status: 400,
    };
  }

  if (claims.email_verified === false) {
    return {
      success: false,
      error: "The identity provider reports this email address as unverified.",
      status: 401,
    };
  }

  const subject = typeof claims.sub === "string" ? claims.sub : null;
  if (!subject) {
    return { success: false, error: "The ID token does not contain a subject.", status: 400 };
  }

  const displayName =
    (typeof claims.name === "string" && claims.name.trim()) ||
    (typeof claims.preferred_username === "string" && claims.preferred_username.trim()) ||
    email.split("@")[0];

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, ssoSubjectId: true, authProvider: true },
  });

  if (existing) {
    // Linking a login to an account that exists already hands that account
    // over, so the provider has to vouch for the address. Without the claim
    // anyone who can register that email at the provider would get in.
    const alreadyLinked = existing.ssoSubjectId === subject;
    if (!alreadyLinked && claims.email_verified !== true && !config.trustUnverifiedEmails) {
      return {
        success: false,
        error:
          "An account with this email already exists, and the identity provider didn't confirm the " +
          "address is verified. An administrator can allow this under System Settings -> SSO.",
        status: 403,
      };
    }

    // Refuse to bind an established account to a different IdP subject: that
    // would let a re-registered identity take over the original account.
    if (existing.ssoSubjectId && existing.ssoSubjectId !== subject) {
      return {
        success: false,
        error: "This account is already linked to a different SSO identity.",
        status: 409,
      };
    }

    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { authProvider: "SSO", ssoSubjectId: subject },
      select: PUBLIC_USER_SELECT,
    });
    return { success: true, user };
  }

  if (!config.autoProvisionUsers) {
    return {
      success: false,
      error: "User auto-provisioning is disabled for SSO logins.",
      status: 403,
    };
  }

  const user = await prisma.user.create({
    data: {
      name: displayName,
      email,
      authProvider: "SSO",
      ssoSubjectId: subject,
      role: config.defaultRole || "Developer",
    },
    select: PUBLIC_USER_SELECT,
  });

  return { success: true, user };
}
