import crypto from "crypto";

/**
 * Minimal, strict verifier for OIDC ID tokens (JWS Compact Serialization).
 *
 * Only signed tokens are accepted: "none" and any algorithm outside the
 * allowlist are rejected before the signature is examined.
 */

const RSA_ALGS: Record<string, string> = {
  RS256: "sha256",
  RS384: "sha384",
  RS512: "sha512",
};

const HMAC_ALGS: Record<string, string> = {
  HS256: "sha256",
  HS384: "sha384",
  HS512: "sha512",
};

/** Tolerance for clock drift between this host and the identity provider. */
const CLOCK_SKEW_SECONDS = 120;

export interface IdTokenClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  nonce?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  [claim: string]: unknown;
}

export interface VerifyOptions {
  /** PEM X.509 certificate from the IdP, used for RS* signatures. */
  certificatePem?: string | null;
  /** Client secret, used for HS* signatures. */
  clientSecret?: string | null;
  /** Required `iss` claim, when configured. */
  expectedIssuer?: string | null;
  /** Required `aud` claim, when configured. */
  expectedAudience?: string | null;
  /** Required `nonce` claim, when the flow established one. */
  expectedNonce?: string | null;
}

export type VerifyIdTokenResult =
  | { valid: true; claims: IdTokenClaims }
  | { valid: false; error: string };

function decodeSegment(segment: string): any {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

/** Read the public key out of a PEM certificate, rejecting expired ones. */
function publicKeyFromCertificate(pem: string): crypto.KeyObject {
  const cert = new crypto.X509Certificate(pem);

  const now = Date.now();
  if (new Date(cert.validTo).getTime() < now) {
    throw new Error("The configured SSO signing certificate has expired.");
  }
  if (new Date(cert.validFrom).getTime() > now) {
    throw new Error("The configured SSO signing certificate is not yet valid.");
  }

  return cert.publicKey;
}

export function verifyIdToken(
  token: string,
  options: VerifyOptions
): VerifyIdTokenResult {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Missing ID token." };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Malformed ID token." };
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;

  let header: { alg?: string; typ?: string };
  let claims: IdTokenClaims;
  try {
    header = decodeSegment(headerSegment);
    claims = decodeSegment(payloadSegment);
  } catch {
    return { valid: false, error: "ID token header or payload is not valid JSON." };
  }

  const alg = header?.alg;
  if (!alg || alg === "none") {
    return { valid: false, error: "Unsigned ID tokens are not accepted." };
  }

  const signingInput = Buffer.from(`${headerSegment}.${payloadSegment}`, "utf8");
  const signature = Buffer.from(signatureSegment, "base64url");

  if (RSA_ALGS[alg]) {
    if (!options.certificatePem) {
      return {
        valid: false,
        error: `ID token is signed with ${alg} but no SSO signing certificate is configured.`,
      };
    }
    let key: crypto.KeyObject;
    try {
      key = publicKeyFromCertificate(options.certificatePem);
    } catch (error: any) {
      return { valid: false, error: error?.message || "Invalid SSO signing certificate." };
    }
    let ok = false;
    try {
      ok = crypto.verify(RSA_ALGS[alg], signingInput, key, signature);
    } catch {
      ok = false;
    }
    if (!ok) return { valid: false, error: "ID token signature verification failed." };
  } else if (HMAC_ALGS[alg]) {
    if (!options.clientSecret) {
      return {
        valid: false,
        error: `ID token is signed with ${alg} but no client secret is configured.`,
      };
    }
    const expected = crypto
      .createHmac(HMAC_ALGS[alg], options.clientSecret)
      .update(signingInput)
      .digest();
    if (
      expected.length !== signature.length ||
      !crypto.timingSafeEqual(expected, signature)
    ) {
      return { valid: false, error: "ID token signature verification failed." };
    }
  } else {
    return { valid: false, error: `Unsupported ID token algorithm: ${alg}.` };
  }

  const now = Math.floor(Date.now() / 1000);

  if (typeof claims.exp !== "number") {
    return { valid: false, error: "ID token is missing an expiry." };
  }
  if (claims.exp + CLOCK_SKEW_SECONDS < now) {
    return { valid: false, error: "ID token has expired." };
  }
  if (typeof claims.nbf === "number" && claims.nbf - CLOCK_SKEW_SECONDS > now) {
    return { valid: false, error: "ID token is not yet valid." };
  }
  if (typeof claims.iat === "number" && claims.iat - CLOCK_SKEW_SECONDS > now) {
    return { valid: false, error: "ID token was issued in the future." };
  }

  if (options.expectedIssuer && claims.iss !== options.expectedIssuer) {
    return { valid: false, error: "ID token issuer does not match the configured provider." };
  }

  if (options.expectedAudience) {
    const audiences = Array.isArray(claims.aud)
      ? claims.aud
      : claims.aud
      ? [claims.aud]
      : [];
    if (!audiences.includes(options.expectedAudience)) {
      return { valid: false, error: "ID token audience does not match the configured client id." };
    }
  }

  if (options.expectedNonce) {
    const provided = Buffer.from(String(claims.nonce ?? ""), "utf8");
    const expected = Buffer.from(options.expectedNonce, "utf8");
    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      return { valid: false, error: "ID token nonce does not match this login attempt." };
    }
  }

  return { valid: true, claims };
}
