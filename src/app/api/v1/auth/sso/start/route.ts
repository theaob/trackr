import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { loadSsoConfig, ssoHasVerificationKey } from "@/lib/auth/sso";
import { SSO_STATE_COOKIE, ssoStateCookieOptions } from "@/lib/auth/ssoState";

export const dynamic = "force-dynamic";

interface DiscoveryDocument {
  authorization_endpoint?: string;
}

let discoveryCache: { issuer: string; document: DiscoveryDocument; fetchedAt: number } | null =
  null;
const DISCOVERY_TTL_MS = 10 * 60 * 1000;

async function discover(issuer: string): Promise<DiscoveryDocument> {
  if (
    discoveryCache &&
    discoveryCache.issuer === issuer &&
    Date.now() - discoveryCache.fetchedAt < DISCOVERY_TTL_MS
  ) {
    return discoveryCache.document;
  }

  const url = `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`Discovery returned HTTP ${res.status}`);
    const document = (await res.json()) as DiscoveryDocument;
    discoveryCache = { issuer, document, fetchedAt: Date.now() };
    return document;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Begin an SSO login: mint a nonce and state, bind them to a short-lived
 * cookie, and redirect to the identity provider's authorization endpoint.
 *
 * The callback refuses any assertion that does not carry both values back,
 * which is what stops a replayed or attacker-supplied token from creating a
 * session in someone else's browser.
 */
export async function GET(request: NextRequest) {
  const config = await loadSsoConfig();

  if (!config.enabled || !ssoHasVerificationKey(config)) {
    return NextResponse.json(
      { error: "SSO is not configured on this instance." },
      { status: 503 }
    );
  }

  if (!config.issuerUrl || !config.clientId) {
    return NextResponse.json(
      { error: "SSO requires both an issuer URL and a client id." },
      { status: 503 }
    );
  }

  let authorizationEndpoint: string;
  try {
    const document = await discover(config.issuerUrl);
    if (!document.authorization_endpoint) {
      throw new Error("Discovery document has no authorization_endpoint");
    }
    authorizationEndpoint = document.authorization_endpoint;
  } catch (error) {
    console.error("SSO discovery failed:", error);
    return NextResponse.json(
      { error: "Could not reach the identity provider's discovery endpoint." },
      { status: 502 }
    );
  }

  const nonce = crypto.randomBytes(16).toString("base64url");
  const state = crypto.randomBytes(16).toString("base64url");
  const redirectUri = new URL("/api/v1/auth/sso/callback", request.nextUrl.origin).toString();

  const authorizeUrl = new URL(authorizationEndpoint);
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("response_type", "id_token");
  authorizeUrl.searchParams.set("response_mode", "form_post");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("nonce", nonce);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set(
    SSO_STATE_COOKIE,
    JSON.stringify({ nonce, state }),
    ssoStateCookieOptions()
  );
  return response;
}
