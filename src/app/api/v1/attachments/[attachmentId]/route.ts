import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { AuthError, projectIdForAttachment, requireProjectAccess } from "@/lib/auth/guards";
import { readAttachmentFile } from "@/lib/attachmentStorage";
import { isPreviewableImageMime } from "@/lib/attachments";

export const dynamic = "force-dynamic";

/**
 * A bare-ASCII fallback for the `filename=` parameter (some clients ignore
 * filename*), plus the UTF-8 filename* parameter for everything else.
 * Neither is trusted with raw control characters or quotes, which could
 * otherwise break out of the header.
 */
function contentDisposition(disposition: "inline" | "attachment", fileName: string): string {
  const safe = fileName.replace(/[\r\n"]/g, "_");
  const asciiFallback = safe.replace(/[^\x20-\x7e]/g, "_");
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { attachmentId: string } }
) {
  try {
    const projectId = await projectIdForAttachment(params.attachmentId);
    await requireProjectAccess(projectId);

    const attachment = await prisma.attachment.findUnique({
      where: { id: params.attachmentId },
    });
    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const data = await readAttachmentFile(attachment.issueId, attachment.storedName);
    // The uploader's declared MIME type is untrusted: only a fixed allow-list of
    // image types is ever rendered inline, and even then always with nosniff.
    // Everything else downloads as an opaque octet-stream, regardless of what
    // was reported at upload time -- a same-origin route is not a safe place to
    // let arbitrary attacker-controlled HTML or SVG execute.
    const previewable = isPreviewableImageMime(attachment.mimeType);

    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": previewable ? attachment.mimeType : "application/octet-stream",
        "Content-Disposition": contentDisposition(previewable ? "inline" : "attachment", attachment.fileName),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to read attachment:", error);
    return NextResponse.json({ error: "Failed to read attachment" }, { status: 500 });
  }
}
