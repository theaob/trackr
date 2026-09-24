import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * A stand-in webhook target for trying webhooks out during development.
 * It has no business on a live instance, so production builds answer 404.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const event = (request.headers.get("x-tamam-event") ?? request.headers.get("x-trackr-event")) || "unknown";
    const body = await request.json();

    return NextResponse.json({
      received: true,
      event,
      // Reports only whether a signature header arrived; nothing here checks it.
      signaturePresent: request.headers.has("x-hub-signature-256"),
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
