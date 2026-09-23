"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  PUBLIC_USER_SELECT,
  endSession,
  getCurrentUser,
  startSession,
} from "@/lib/auth/session";
import { AuthError, requireInstanceAdmin, requireUser, toActionError } from "@/lib/auth/guards";
import { loadSsoConfig, ssoHasVerificationKey } from "@/lib/auth/sso";
import {
  clientAddressFrom,
  signInByAccount,
  signInByClient,
  tooManyAttemptsMessage,
} from "@/lib/auth/attemptLimiter";

async function requestClientAddress(): Promise<string | null> {
  try {
    return clientAddressFrom(await headers());
  } catch {
    return null;
  }
}

const MIN_PASSWORD_LENGTH = 8;

/**
 * Whether the sign-in page offers "Create account". Public: it's read before
 * anyone is signed in. An instance administrator can turn it off.
 */
export async function isSelfRegistrationOpen(): Promise<boolean> {
  try {
    const settings = await prisma.instanceSettings.findUnique({ where: { id: "default" } });
    return settings?.allowSelfRegistration ?? true;
  } catch (error) {
    console.error("Failed to read instance settings:", error);
    return false;
  }
}

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
    if (!(await isSelfRegistrationOpen())) {
      return {
        success: false,
        error: "Creating an account here is turned off. Ask an administrator to invite you.",
      };
    }

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

    await startSession(user.id);

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

    // Unknown emails are throttled exactly like real ones, so the lockout
    // message can't be used to find out which accounts exist.
    const client = await requestClientAddress();
    const wait = Math.max(
      signInByAccount.retryAfterMs(trimmedEmail),
      client ? signInByClient.retryAfterMs(client) : 0
    );
    if (wait > 0) return { success: false as const, error: tooManyAttemptsMessage(wait) };
    const recordFailure = () => {
      signInByAccount.recordFailure(trimmedEmail);
      if (client) signInByClient.recordFailure(client);
    };

    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
      select: { id: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      recordFailure();
      // Databases created before passwords existed have no hashes at all, and
      // every sign-in would otherwise look like a typo. Report that only when
      // it is true of the whole instance, so this never becomes a way to test
      // whether an individual account exists.
      if (await instanceHasNoPasswords()) {
        return {
          success: false as const,
          error:
            "No account on this instance has a password set yet. An administrator " +
            "needs to run `npm run set-password -- <email>` (or `npm run db:seed` " +
            "to recreate the demo data).",
        };
      }
      return genericFailure;
    }

    const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      recordFailure();
      return genericFailure;
    }
    signInByAccount.reset(trimmedEmail);

    if (needsRehash) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
      });
    }

    // The caller's own admin flag, so the client can show instance settings
    // without a reload; it goes only to this user, never into user lists.
    const safeUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { ...PUBLIC_USER_SELECT, isInstanceAdmin: true },
    });

    await startSession(safeUser.id);

    try {
      revalidatePath("/projects");
    } catch {}

    return { success: true as const, user: safeUser };
  } catch (error) {
    console.error("Failed to login user:", error);
    return { success: false, error: "Authentication failed." };
  }
}

/**
 * True when no account at all can sign in with a password, which is the state
 * an upgrade from a version without authentication leaves behind.
 */
async function instanceHasNoPasswords(): Promise<boolean> {
  const withPassword = await prisma.user.count({ where: { NOT: { passwordHash: null } } });
  return withPassword === 0;
}

/**
 * Change the signed-in user's password. Every other session ends; this one is
 * re-issued so the person making the change stays signed in. Wrong current
 * passwords count toward the same lockout as failed sign-ins, so a stolen
 * session can't be used to guess the password.
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  try {
    const sessionUser = await requireUser();
    const account = await prisma.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!account.passwordHash) {
      return {
        success: false as const,
        error: "Your account signs in through SSO, so its password is managed by your identity provider.",
      };
    }
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return {
        success: false as const,
        error: `The new password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      };
    }

    const lockKey = account.email.toLowerCase();
    const wait = signInByAccount.retryAfterMs(lockKey);
    if (wait > 0) return { success: false as const, error: tooManyAttemptsMessage(wait) };

    const { valid } = await verifyPassword(currentPassword || "", account.passwordHash);
    if (!valid) {
      signInByAccount.recordFailure(lockKey);
      return { success: false as const, error: "Your current password is incorrect." };
    }
    signInByAccount.reset(lockKey);

    await prisma.user.update({
      where: { id: account.id },
      data: { passwordHash: await hashPassword(newPassword), sessionVersion: { increment: 1 } },
    });
    await startSession(account.id);
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to change password");
  }
}

/** End every session of the signed-in user except this one. */
export async function signOutOtherSessions() {
  try {
    const user = await requireUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
    });
    await startSession(user.id);
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to sign out other sessions");
  }
}

export async function logout() {
  await endSession();
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
    await requireInstanceAdmin();
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
  trustUnverifiedEmails?: boolean;
  defaultRole?: string;
}) {
  try {
    await requireInstanceAdmin();

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
    if (data.trustUnverifiedEmails !== undefined) {
      update.trustUnverifiedEmails = data.trustUnverifiedEmails;
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
