"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  PUBLIC_USER_SELECT,
  endSession,
  getCurrentUser,
  startSession,
} from "@/lib/auth/session";
import { AuthError, requireAnyProjectAdmin, toActionError } from "@/lib/auth/guards";
import { loadSsoConfig, ssoHasVerificationKey } from "@/lib/auth/sso";

const MIN_PASSWORD_LENGTH = 8;

/** The signed-in user, for client components that need to refresh it. */
export async function getSessionUser() {
  return getCurrentUser();
}

/**
 * Register an independent local account and sign it in.
 *
 * New accounts deliberately receive no project memberships: access is granted
 * by a project administrator, or by creating a project of their own.
 */
export async function registerUser(data: {
  name: string;
  email: string;
  password?: string;
  role?: string;
}) {
  try {
    const email = data.email.trim().toLowerCase();
    const name = data.name.trim();

    if (!email || !name) {
      return { success: false, error: "Name and Email are required." };
    }

    if (!data.password || data.password.length < MIN_PASSWORD_LENGTH) {
      return {
        success: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return { success: false, error: "An account with this email address already exists." };
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(data.password),
        authProvider: "LOCAL",
        role: data.role || "Developer",
      },
      select: PUBLIC_USER_SELECT,
    });

    startSession(user.id);

    try {
      revalidatePath("/projects");
    } catch {}

    return { success: true as const, user };
  } catch (error) {
    return toActionError(error, "Failed to create user account");
  }
}

/**
 * Sign in with email and password.
 *
 * Fails closed: an account without a usable password hash (SSO-only, or never
 * given one) cannot be signed into on this path.
 */
export async function loginWithCredentials(email: string, password?: string) {
  const genericFailure = { success: false as const, error: "Incorrect email or password." };

  try {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) return genericFailure;

    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
      select: { id: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) return genericFailure;

    const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);
    if (!valid) return genericFailure;

    if (needsRehash) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
      });
    }

    const safeUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: PUBLIC_USER_SELECT,
    });

    startSession(safeUser.id);

    try {
      revalidatePath("/projects");
    } catch {}

    return { success: true as const, user: safeUser };
  } catch (error) {
    console.error("Failed to login user:", error);
    return { success: false, error: "Authentication failed." };
  }
}

/** Change the signed-in user's own password. */
export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new AuthError("You must be signed in to change your password.", 401);

    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return {
        success: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      };
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.id },
      select: { passwordHash: true },
    });

    // An account with no password yet (SSO-provisioned) can set one; an account
    // that has one must prove it knows the current value.
    if (user.passwordHash) {
      const { valid } = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) return { success: false, error: "Current password is incorrect." };
    }

    await prisma.user.update({
      where: { id: session.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to change password");
  }
}

export async function logout() {
  endSession();
  try {
    revalidatePath("/", "layout");
  } catch {}
  return { success: true as const };
}

/**
 * Non-sensitive SSO details for the sign-in screen. Never exposes key material.
 */
export async function getSsoPublicConfig() {
  try {
    const config = await loadSsoConfig();
    return {
      enabled: config.enabled && ssoHasVerificationKey(config),
      providerName: config.providerName,
    };
  } catch (error) {
    console.error("Failed to fetch SSO config:", error);
    return { enabled: false, providerName: "Enterprise SSO" };
  }
}

/**
 * Full SSO configuration for the settings screen, minus the client secret;
 * `hasClientSecret` reports whether one is stored.
 */
export async function getSsoConfig() {
  try {
    await requireAnyProjectAdmin();
    const config = await loadSsoConfig();

    const { clientSecret, ...rest } = config;
    return {
      ...rest,
      clientSecret: "",
      hasClientSecret: !!clientSecret,
      configured: ssoHasVerificationKey(config),
    };
  } catch (error) {
    if (error instanceof AuthError) return null;
    console.error("Failed to fetch SSO config:", error);
    return null;
  }
}

export async function updateSsoConfig(data: {
  enabled?: boolean;
  providerName?: string;
  issuerUrl?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  certificate?: string | null;
  autoProvisionUsers?: boolean;
  defaultRole?: string;
}) {
  try {
    await requireAnyProjectAdmin();

    const certificate = data.certificate?.trim() || null;
    if (certificate && !certificate.includes("-----BEGIN CERTIFICATE-----")) {
      return {
        success: false,
        error: "The signing certificate must be a PEM-encoded X.509 certificate.",
      };
    }

    const update: Record<string, unknown> = {};
    if (data.enabled !== undefined) update.enabled = data.enabled;
    if (data.providerName !== undefined) update.providerName = data.providerName;
    if (data.issuerUrl !== undefined) update.issuerUrl = data.issuerUrl?.trim() || null;
    if (data.clientId !== undefined) update.clientId = data.clientId?.trim() || null;
    if (data.certificate !== undefined) update.certificate = certificate;
    if (data.autoProvisionUsers !== undefined) {
      update.autoProvisionUsers = data.autoProvisionUsers;
    }
    if (data.defaultRole !== undefined) update.defaultRole = data.defaultRole;

    // An empty client secret means "leave the stored one alone" so that the
    // settings form does not have to round-trip the value.
    if (data.clientSecret) update.clientSecret = data.clientSecret.trim();

    await loadSsoConfig();
    const updated = await prisma.ssoConfig.update({
      where: { id: "default" },
      data: update,
    });

    if (updated.enabled && !ssoHasVerificationKey(updated as any)) {
      return {
        success: false,
        error:
          "SSO cannot be enabled without an X.509 signing certificate or a client secret to verify tokens with.",
      };
    }

    const { clientSecret, ...rest } = updated;
    return {
      success: true as const,
      config: {
        ...rest,
        clientSecret: "",
        hasClientSecret: !!clientSecret,
        configured: ssoHasVerificationKey(updated as any),
      },
    };
  } catch (error) {
    return toActionError(error, "Failed to update SSO configuration");
  }
}
