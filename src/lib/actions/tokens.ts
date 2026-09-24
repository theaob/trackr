"use server";

import prisma from "@/lib/db";
import { CreateTokenResult, PersonalAccessToken } from "@/types";
import { requireUser, toActionError } from "@/lib/auth/guards";
import {
  TOKEN_DISPLAY_PREFIX_LENGTH,
  generateRawToken,
  hashToken,
} from "@/lib/auth/tokens";


/**
 * Tokens belonging to the signed-in user. The caller cannot ask for anyone
 * else's: the owner comes from the session, not from the arguments.
 */
export async function getUserTokens(_userId?: string): Promise<PersonalAccessToken[]> {
  try {
    const user = await requireUser();
    const tokens = await prisma.personalAccessToken.findMany({
      where: { userId: user.id },
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
  /** Ignored: tokens are always minted for the signed-in user. */
  userId?: string;
  name: string;
  expirationDays: number | null;
}): Promise<CreateTokenResult> {
  try {
    const user = await requireUser();
    const { name, expirationDays } = params;

    if (!name || name.trim() === "") {
      return { success: false, error: "Token name is required" };
    }

    const userId = user.id;
    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const tokenPrefix = rawToken.slice(0, TOKEN_DISPLAY_PREFIX_LENGTH); // e.g. "tamam_pat_ab123"
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
  } catch (error) {
    return toActionError(error, "Failed to create personal access token");
  }
}

/**
 * Revoke an active token
 */
export async function revokePersonalAccessToken(tokenId: string, _userId?: string) {
  try {
    const user = await requireUser();
    const existing = await prisma.personalAccessToken.findFirst({
      where: { id: tokenId, userId: user.id },
    });
    if (!existing) {
      return { success: false, error: "Token not found" };
    }

    await prisma.personalAccessToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    return toActionError(error, "Failed to revoke token");
  }
}

/**
 * Permanently delete a token
 */
export async function deletePersonalAccessToken(tokenId: string, _userId?: string) {
  try {
    const user = await requireUser();
    const existing = await prisma.personalAccessToken.findFirst({
      where: { id: tokenId, userId: user.id },
    });
    if (!existing) {
      return { success: false, error: "Token not found" };
    }

    await prisma.personalAccessToken.delete({
      where: { id: tokenId },
    });

    return { success: true };
  } catch (error) {
    return toActionError(error, "Failed to delete token");
  }
}
