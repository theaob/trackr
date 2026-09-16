"use server";

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import prisma from "@/lib/db";

const AVATAR_DIR = path.join(process.cwd(), "data", "avatars");
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function ensureAvatarDir() {
  await fs.mkdir(AVATAR_DIR, { recursive: true });
}

// GET — serve avatar image from disk
export async function GET(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  try {
    await ensureAvatarDir();

    // Try common extensions
    const extensions = [".webp", ".png", ".jpg", ".jpeg", ".gif"];
    for (const ext of extensions) {
      const filePath = path.join(AVATAR_DIR, `${userId}${ext}`);
      try {
        const data = await fs.readFile(filePath);
        const contentType =
          ext === ".webp"
            ? "image/webp"
            : ext === ".png"
            ? "image/png"
            : ext === ".gif"
            ? "image/gif"
            : "image/jpeg";

        return new NextResponse(data, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600, must-revalidate",
          },
        });
      } catch {
        // File doesn't exist with this extension, try next
      }
    }

    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  } catch {
    return NextResponse.json(
      { error: "Failed to read avatar" },
      { status: 500 }
    );
  }
}

// POST — upload avatar image
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  try {
    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
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

    // Remove any existing avatar files for this user
    const extensions = [".webp", ".png", ".jpg", ".jpeg", ".gif"];
    for (const ext of extensions) {
      try {
        await fs.unlink(path.join(AVATAR_DIR, `${userId}${ext}`));
      } catch {
        // Ignore if file doesn't exist
      }
    }

    // Determine extension from mime type
    const extMap: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
    };
    const ext = extMap[file.type] || ".png";
    const filePath = path.join(AVATAR_DIR, `${userId}${ext}`);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // Update user's avatarUrl in database
    const avatarUrl = `/api/v1/users/${userId}/avatar?t=${Date.now()}`;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}

// DELETE — remove avatar, revert to initials
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await ensureAvatarDir();

    // Remove any existing avatar files
    const extensions = [".webp", ".png", ".jpg", ".jpeg", ".gif"];
    for (const ext of extensions) {
      try {
        await fs.unlink(path.join(AVATAR_DIR, `${userId}${ext}`));
      } catch {
        // Ignore
      }
    }

    // Clear avatarUrl in database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Avatar delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete avatar" },
      { status: 500 }
    );
  }
}
