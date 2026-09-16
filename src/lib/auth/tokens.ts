import crypto from "crypto";
import prisma from "@/lib/db";
import { PUBLIC_USER_SELECT, SessionUser } from "@/lib/auth/publicUser";

/** Personal access tokens are stored as a SHA-256 digest, never in the clear. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateRawToken(): string {
  return `jira_pat_${crypto.randomBytes(24).toString("hex")}`;
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
    if (!rawToken || !rawToken.startsWith("jira_pat_")) {
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
