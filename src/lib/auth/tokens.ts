import crypto from "crypto";
import prisma from "@/lib/db";
import { PUBLIC_USER_SELECT, SessionUser } from "@/lib/auth/publicUser";

/**
 * Marks a string as a Tamam personal access token.
 *
 * Secret scanners key off a fixed prefix like this, and validation rejects
 * anything without it before touching the database.
 */
export const TOKEN_PREFIX = "tamam_pat_";

/** Tokens created before the rename to Tamam, which keep working. */
export const LEGACY_TOKEN_PREFIX = "trackr_pat_";

export function hasTokenPrefix(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX) || token.startsWith(LEGACY_TOKEN_PREFIX);
}

/** How much of a token is stored in the clear, for display: prefix + 5 chars. */
export const TOKEN_DISPLAY_PREFIX_LENGTH = TOKEN_PREFIX.length + 5;

/** Personal access tokens are stored as a SHA-256 digest, never in the clear. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateRawToken(): string {
  return `${TOKEN_PREFIX}${crypto.randomBytes(24).toString("hex")}`;
}

export type TokenValidationResult =
  | {
      valid: true;
      user: SessionUser;
      token: { id: string; name: string; expiresAt: Date | null; lastUsedAt: Date | null };
    }
  | { valid: false; error: string };

/**
 * Authenticate a raw Bearer token and record its use.
 *
 * Deliberately a plain module rather than a server action: nothing in a
 * browser should be able to submit tokens here to see which ones are valid.
 */
export async function validatePersonalAccessToken(
  rawToken: string
): Promise<TokenValidationResult> {
  try {
    if (!rawToken || !hasTokenPrefix(rawToken)) {
      return { valid: false, error: "Invalid token format" };
    }

    const tokenRecord = await prisma.personalAccessToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      select: {
        id: true,
        name: true,
        expiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
        user: { select: PUBLIC_USER_SELECT },
      },
    });

    if (!tokenRecord) {
      return { valid: false, error: "Token not found or invalid" };
    }
    if (tokenRecord.revokedAt) {
      return { valid: false, error: "Token has been revoked" };
    }
    if (tokenRecord.expiresAt && new Date() > tokenRecord.expiresAt) {
      return { valid: false, error: "Token has expired" };
    }

    // Recorded opportunistically; a failure here must not fail the request.
    prisma.personalAccessToken
      .update({
        where: { id: tokenRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => console.error("Error updating lastUsedAt:", err));

    return {
      valid: true,
      user: tokenRecord.user,
      token: {
        id: tokenRecord.id,
        name: tokenRecord.name,
        expiresAt: tokenRecord.expiresAt,
        lastUsedAt: tokenRecord.lastUsedAt,
      },
    };
  } catch (error) {
    console.error("Failed to validate personal access token:", error);
    return { valid: false, error: "Internal validation error" };
  }
}
