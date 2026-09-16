import { NextRequest, NextResponse } from "next/server";
import { validatePersonalAccessToken } from "@/lib/actions/tokens";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      {
        authenticated: false,
        error: "Missing or malformed Authorization header. Expected: Bearer <jira_pat_...>",
      },
      { status: 401 }
    );
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const result = await validatePersonalAccessToken(token);

  if (!result.valid || !result.user) {
    return NextResponse.json(
      {
        authenticated: false,
        error: result.error || "Invalid or expired token",
      },
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
