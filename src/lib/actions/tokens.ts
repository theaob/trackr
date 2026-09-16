"use server";

import crypto from "crypto";
import prisma from "@/lib/db";
import { CreateTokenResult, PersonalAccessToken } from "@/types";

/**
 * Generate a cryptographically secure Personal Access Token string
 * Format: jira_pat_<48 hex chars>
 */
export async function generateRawToken(): Promise<string> {
  const entropy = crypto.randomBytes(24).toString("hex");
  return `jira_pat_${entropy}`;
}

/**
 * Calculate SHA-256 hash for a given token string (internal helper)
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}


/**
 * Fetch all tokens for a given user
 */
export async function getUserTokens(userId: string): Promise<PersonalAccessToken[]> {
  try {
    const tokens = await prisma.personalAccessToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return tokens as unknown as PersonalAccessToken[];
  } catch (error) {
    console.error("Failed to fetch user tokens:", error);
    return [];
  }
}

/**
 * Create a new personal access token for a user
 * Returns the raw token string ONLY ONCE upon creation
 */
export async function createPersonalAccessToken(params: {
  userId: string;
  name: string;
  expirationDays: number | null;
}): Promise<CreateTokenResult> {
  try {
    const { userId, name, expirationDays } = params;

    if (!name || name.trim() === "") {
      return { success: false, error: "Token name is required" };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const rawToken = await generateRawToken();
    const tokenHash = hashToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 14); // e.g. "jira_pat_ab123"
    const lastFour = rawToken.slice(-4);

    const expiresAt =
      expirationDays && expirationDays > 0
        ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
        : null;

    const tokenRecord = await prisma.personalAccessToken.create({
      data: {
        name: name.trim(),
        tokenHash,
        tokenPrefix,
        lastFour,
        userId,
        expiresAt,
      },
    });

    return {
      success: true,
      token: rawToken,
      tokenData: tokenRecord as unknown as PersonalAccessToken,
    };
  } catch (error: any) {
    console.error("Failed to create personal access token:", error);
    return {
      success: false,
      error: error?.message || "Failed to create personal access token",
    };
  }
}

/**
 * Revoke an active token
 */
export async function revokePersonalAccessToken(tokenId: string, userId: string) {
  try {
    const existing = await prisma.personalAccessToken.findFirst({
      where: { id: tokenId, userId },
    });
    if (!existing) {
      return { success: false, error: "Token not found" };
    }

    await prisma.personalAccessToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Failed to revoke token:", error);
    return { success: false, error: "Failed to revoke token" };
  }
}

/**
 * Permanently delete a token
 */
export async function deletePersonalAccessToken(tokenId: string, userId: string) {
  try {
    const existing = await prisma.personalAccessToken.findFirst({
      where: { id: tokenId, userId },
    });
    if (!existing) {
      return { success: false, error: "Token not found" };
    }

    await prisma.personalAccessToken.delete({
      where: { id: tokenId },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete token:", error);
    return { success: false, error: "Failed to delete token" };
  }
}

/**
 * Authenticate and validate a raw Bearer PAT string
 * Updates lastUsedAt if valid
 */
export async function validatePersonalAccessToken(rawToken: string) {
  try {
    if (!rawToken || !rawToken.startsWith("jira_pat_")) {
      return { valid: false, error: "Invalid token format" };
    }

    const tokenHash = hashToken(rawToken);
    const tokenRecord = await prisma.personalAccessToken.findUnique({
      where: { tokenHash },
      include: { user: true },
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

    // Update lastUsedAt in the background
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
  } catch (error: any) {
    console.error("Failed to validate personal access token:", error);
    return { valid: false, error: "Internal validation error" };
  }
}
