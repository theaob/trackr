import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const event = request.headers.get("x-jira-event") || "unknown";
    const signature = request.headers.get("x-hub-signature-256") || "none";
    const body = await request.json();

    return NextResponse.json({
      received: true,
      event,
      signatureVerified: signature !== "none",
      receivedAt: new Date().toISOString(),
      payloadSummary: {
        event: body.event,
        hasData: !!body.data,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Invalid JSON payload", details: error?.message },
      { status: 400 }
    );
  }
}
