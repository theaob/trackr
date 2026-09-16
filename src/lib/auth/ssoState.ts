export const SSO_STATE_COOKIE = "trackr_sso_state";

/** The login attempt is short-lived and must never be readable from script. */
export function ssoStateCookieOptions() {
  return {
    httpOnly: true as const,
    // The identity provider posts the assertion back cross-site, so the cookie
    // has to survive that navigation.
    sameSite: "none" as const,
    secure: true as const,
    path: "/api/v1/auth/sso",
    maxAge: 10 * 60,
  };
}

export interface SsoStatePayload {
  nonce: string;
  state: string;
}

export function parseSsoState(raw: string | undefined): SsoStatePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.nonce === "string" && typeof parsed?.state === "string") {
      return parsed;
    }
  } catch {
    // Fall through.
  }
  return null;
}
