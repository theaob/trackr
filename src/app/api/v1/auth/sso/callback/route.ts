import { NextRequest, NextResponse } from "next/server";
import { processSsoLogin, getSsoConfig } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body.email || body.user?.email;
    const name = body.name || body.user?.name || email?.split("@")[0] || "SSO User";
    const ssoSubjectId = body.sub || body.subjectId || body.nameID;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "SSO assertion missing required email claim." },
        { status: 400 }
      );
    }

    const config = await getSsoConfig();

    if (config.allowSelfSignedCerts) {
      // Configure Node/HTTPS TLS bypass for self-signed certificates
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    const result = await processSsoLogin({
      email,
      name,
      ssoSubjectId,
      certificatePEM: config.certificate || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: "SSO authentication successful",
      user: result.user,
      ssoDetails: result.ssoDetails,
    });
  } catch (error) {
    console.error("SSO Callback Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal SSO authentication error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get("email");
  const name = searchParams.get("name") || email?.split("@")[0] || "SSO User";

  if (!email) {
    return NextResponse.json(
      { error: "Missing email parameter in SSO GET callback" },
      { status: 400 }
    );
  }

  const result = await processSsoLogin({
    email,
    name,
    ssoSubjectId: `sso_get_${Date.now()}`,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 401 });
  }

  // Redirect to project directory on successful SSO login
  return NextResponse.redirect(new URL(`/projects?sso_login=success&user=${encodeURIComponent(result.user!.email)}`, request.url));
}
