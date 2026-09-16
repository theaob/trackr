import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { avatarDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const EXTENSIONS = [".webp", ".png", ".jpg", ".jpeg", ".gif"];
const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};
const EXTENSION_FOR_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/**
 * The id becomes part of a filename, so only the cuid shape Prisma generates is
 * accepted. Without this, a crafted id such as "../../config" escapes the
 * avatar directory.
 */
function isSafeUserId(userId: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(userId);
}

async function ensureAvatarDir() {
  await fs.mkdir(avatarDir(), { recursive: true });
}

async function removeExistingAvatars(userId: string) {
  for (const ext of EXTENSIONS) {
    try {
      await fs.unlink(path.join(avatarDir(), `${userId}${ext}`));
    } catch {
      // Not present with this extension.
    }
  }
}

/** Only the owner of an avatar may change or remove it. */
async function authorizeSelf(userId: string) {
  if (!isSafeUserId(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (session.id !== userId) {
    return NextResponse.json(
      { error: "You can only change your own avatar" },
      { status: 403 }
    );
  }
  return null;
}

// GET - serve avatar image from disk
export async function GET(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  if (!isSafeUserId(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  // Avatars are only served to signed-in users, like the rest of the app.
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    await ensureAvatarDir();

    for (const ext of EXTENSIONS) {
      const filePath = path.join(avatarDir(), `${userId}${ext}`);
      try {
        const data = await fs.readFile(filePath);
        return new NextResponse(data, {
          status: 200,
          headers: {
            "Content-Type": CONTENT_TYPES[ext],
            "Cache-Control": "private, max-age=3600, must-revalidate",
          },
        });
      } catch {
        // Not present with this extension; try the next one.
      }
    }

    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Failed to read avatar" }, { status: 500 });
  }
}

// POST - upload avatar image
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  const denied = await authorizeSelf(userId);
  if (denied) return denied;

  try {
    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = EXTENSION_FOR_TYPE[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 2MB" },
        { status: 400 }
      );
    }

    await ensureAvatarDir();
    await removeExistingAvatars(userId);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(avatarDir(), `${userId}${ext}`), buffer);

    const avatarUrl = `/api/v1/users/${userId}/avatar?t=${Date.now()}`;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
  }
}

// DELETE - remove avatar, revert to initials
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  const denied = await authorizeSelf(userId);
  if (denied) return denied;

  try {
    await ensureAvatarDir();
    await removeExistingAvatars(userId);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Avatar delete error:", error);
    return NextResponse.json({ error: "Failed to delete avatar" }, { status: 500 });
  }
}
