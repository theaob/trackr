import path from "path";
import { setting } from "@/lib/env";

/**
 * Writable data directory. Matches the volume mounted at /app/data by the
 * Docker image; falls back to ./data for local development.
 */
export function dataDir(): string {
  const configured = setting("DATA_DIR");
  if (configured) return configured;
  return path.join(process.cwd(), "data");
}

export function avatarDir(): string {
  return path.join(dataDir(), "avatars");
}

/**
 * The issue id becomes a directory name, so only Prisma's cuid shape is
 * accepted -- the same defense as avatarDir's isSafeUserId check, guarding
 * against a crafted id escaping the attachments directory.
 */
function isSafeCuid(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

export function attachmentDir(issueId?: string): string {
  const base = path.join(dataDir(), "attachments");
  if (!issueId) return base;
  if (!isSafeCuid(issueId)) throw new Error("Invalid issue id");
  return path.join(base, issueId);
}
