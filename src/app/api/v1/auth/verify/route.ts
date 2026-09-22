import { NextRequest, NextResponse } from "next/server";
import { TOKEN_PREFIX, validatePersonalAccessToken } from "@/lib/auth/tokens";
import { clientAddressFrom, tokenByClient, tooManyAttemptsMessage } from "@/lib/auth/attemptLimiter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      {
        authenticated: false,
        error: `Missing or malformed Authorization header. Expected: Bearer <${TOKEN_PREFIX}...>`,
      },
      { status: 401 }
    );
  }

  const client = clientAddressFrom(request.headers);
  const wait = client ? tokenByClient.retryAfterMs(client) : 0;
  if (wait > 0) {
    return NextResponse.json(
      { authenticated: false, error: tooManyAttemptsMessage(wait) },
      { status: 429, headers: { "Retry-After": String(Math.ceil(wait / 1000)) } }
    );
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const result = await validatePersonalAccessToken(token);

  if (!result.valid) {
    if (client) tokenByClient.recordFailure(client);
    return NextResponse.json(
      { authenticated: false, error: result.error },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
    },
    token: result.token,
    message: "Personal Access Token authenticated successfully",
  });
}
