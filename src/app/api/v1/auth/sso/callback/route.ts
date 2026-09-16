import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { loginWithIdToken } from "@/lib/auth/sso";
import { SSO_STATE_COOKIE, parseSsoState } from "@/lib/auth/ssoState";
import { startSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function timingSafeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Identity provider callback.
 *
 * A session is created only from an ID token whose signature, issuer,
 * audience, expiry and nonce all verify against the stored configuration.
 * No identity is ever taken from request parameters.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let idToken: string | undefined;
    let state: string | undefined;
    let wantsHtmlRedirect = false;

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({} as any));
      idToken = body?.id_token;
      state = body?.state;
    } else {
      // OIDC form_post response mode.
      const form = await request.formData().catch(() => null);
      idToken = (form?.get("id_token") as string | null) ?? undefined;
      state = (form?.get("state") as string | null) ?? undefined;
      wantsHtmlRedirect = true;

      const providerError = form?.get("error");
      if (typeof providerError === "string" && providerError) {
        return fail(request, "The identity provider rejected the login.", 401, wantsHtmlRedirect);
      }
    }

    if (!idToken) {
      return fail(request, "SSO response did not include an ID token.", 400, wantsHtmlRedirect);
    }

    const pending = parseSsoState(request.cookies.get(SSO_STATE_COOKIE)?.value);
    if (!pending) {
      return fail(
        request,
        "This login attempt has expired. Start again from the sign-in page.",
        400,
        wantsHtmlRedirect
      );
    }

    if (!state || !timingSafeEquals(state, pending.state)) {
      return fail(request, "SSO state did not match this login attempt.", 400, wantsHtmlRedirect);
    }

    const result = await loginWithIdToken(idToken, pending.nonce);

    if (!result.success) {
      return fail(request, result.error, result.status, wantsHtmlRedirect);
    }

    startSession(result.user.id);

    const response = wantsHtmlRedirect
      ? NextResponse.redirect(new URL("/projects", request.nextUrl.origin), 303)
      : NextResponse.json({ success: true, user: result.user });

    // The attempt is single-use.
    response.cookies.delete({ name: SSO_STATE_COOKIE, path: "/api/v1/auth/sso" });
    return response;
  } catch (error) {
    console.error("SSO Callback Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal SSO authentication error" },
      { status: 500 }
    );
  }
}

function fail(
  request: NextRequest,
  message: string,
  status: number,
  redirect: boolean
): NextResponse {
  const response = redirect
    ? NextResponse.redirect(
        new URL(`/login?sso_error=${encodeURIComponent(message)}`, request.nextUrl.origin),
        303
      )
    : NextResponse.json({ success: false, error: message }, { status });

  response.cookies.delete({ name: SSO_STATE_COOKIE, path: "/api/v1/auth/sso" });
  return response;
}

/**
 * Logging in from query parameters is not supported: it allowed anyone to
 * assume any identity by visiting a URL.
 */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "SSO login must be completed with a signed ID token posted by the identity provider. Start at /api/v1/auth/sso/start.",
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}
