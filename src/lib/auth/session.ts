import crypto from "crypto";
import fs from "fs";
import path from "path";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import prisma from "@/lib/db";
import { dataDir } from "@/lib/paths";
import { PUBLIC_USER_SELECT, SessionUser } from "@/lib/auth/publicUser";
import { ensureInstanceAdminExists } from "@/lib/auth/instanceAdmin";
import { settingOn } from "@/lib/env";

export { PUBLIC_USER_SELECT };
export type { SessionUser };

export const SESSION_COOKIE = "tamam_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SECRET_FILE = ".session-secret";

let cachedSecret: Buffer | null = null;

/**
 * Resolve the HMAC key used to sign session cookies.
 *
 * AUTH_SECRET is preferred. Without it a random secret is generated once and
 * persisted in the data directory so that sessions survive restarts; the
 * exclusive create keeps concurrent first requests from racing.
 */
function getSecret(): Buffer {
  if (cachedSecret) return cachedSecret;

  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    cachedSecret = Buffer.from(fromEnv, "utf8");
    return cachedSecret;
  }
  if (fromEnv) {
    throw new Error("AUTH_SECRET must be at least 32 characters long.");
  }

  const dir = dataDir();
  const file = path.join(dir, SECRET_FILE);

  try {
    cachedSecret = Buffer.from(fs.readFileSync(file, "utf8").trim(), "utf8");
    if (cachedSecret.length >= 32) return cachedSecret;
  } catch {
    // Not created yet.
  }

  fs.mkdirSync(dir, { recursive: true });
  const generated = crypto.randomBytes(48).toString("hex");
  try {
    const fd = fs.openSync(file, "wx", 0o600);
    fs.writeSync(fd, generated);
    fs.closeSync(fd);
    cachedSecret = Buffer.from(generated, "utf8");
  } catch {
    // Another worker won the race; use whatever landed on disk.
    cachedSecret = Buffer.from(fs.readFileSync(file, "utf8").trim(), "utf8");
  }
  return cachedSecret;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function createToken(userId: string, sessionVersion: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({ uid: userId, sv: sessionVersion, iat: now, exp: now + SESSION_MAX_AGE_SECONDS })
  );
  return `v1.${payload}.${sign(payload)}`;
}

/** Verify the signature and expiry, returning the user id and session version it carries. */
function readToken(token: string | undefined): { userId: string; sessionVersion: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;

  const [, payload, signature] = parts;
  const expected = Buffer.from(sign(payload), "utf8");
  const provided = Buffer.from(signature, "utf8");
  if (expected.length !== provided.length) return null;
  if (!crypto.timingSafeEqual(expected, provided)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof decoded?.uid !== "string" || typeof decoded?.exp !== "number") return null;
    if (decoded.exp * 1000 <= Date.now()) return null;
    // Cookies from before session versions existed count as version 0.
    return { userId: decoded.uid, sessionVersion: typeof decoded.sv === "number" ? decoded.sv : 0 };
  } catch {
    return null;
  }
}

/**
 * The signed-in user for this request, or null.
 *
 * Cached per request so the many callers in a single render share one query.
 * The user is always re-read from the database, so a deleted account loses
 * access immediately rather than at cookie expiry.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = readToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!token) return null;

  try {
    await ensureInstanceAdminExists();
    const user = await prisma.user.findUnique({
      where: { id: token.userId },
      // isInstanceAdmin is read for the session only, not added to
      // PUBLIC_USER_SELECT: user lists shouldn't advertise who the admins are.
      select: { ...PUBLIC_USER_SELECT, isInstanceAdmin: true, sessionVersion: true },
    });
    // A cookie from before the last password change or "sign out everywhere".
    if (!user || user.sessionVersion !== token.sessionVersion) return null;
    const { sessionVersion: _version, ...sessionUser } = user;
    return sessionUser;
  } catch (error) {
    console.error("Failed to resolve session user:", error);
    return null;
  }
});

/**
 * Whether this request reached us over HTTPS, so the session cookie can be
 * marked Secure without breaking sign-in.
 *
 * NODE_ENV alone is the wrong signal: a self-hosted production deployment
 * commonly serves plain HTTP directly (`docker run -p 3000:3000`, no
 * certificate) or has TLS terminated by a reverse proxy in front of it. A
 * cookie marked Secure is silently dropped by the browser on any non-HTTPS
 * origin other than localhost, which looks like sign-in "not sticking" --
 * every request after it comes back anonymous. TAMAM_TRUST_PROXY opts into
 * trusting X-Forwarded-Proto from a reverse proxy that terminates TLS.
 */
async function isSecureRequest(): Promise<boolean> {
  if (!settingOn("TRUST_PROXY")) return false;
  try {
    return (await headers()).get("x-forwarded-proto") === "https";
  } catch {
    return false;
  }
}

/** Issue a session cookie. Only valid inside a server action or route handler. */
export async function startSession(userId: string) {
  const { sessionVersion } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { sessionVersion: true },
  });
  (await cookies()).set(SESSION_COOKIE, createToken(userId, sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecureRequest(),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Clear the session cookie. Only valid inside a server action or route handler. */
export async function endSession() {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecureRequest(),
    path: "/",
    maxAge: 0,
  });
}
