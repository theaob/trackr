import crypto from "crypto";
import { promisify } from "util";

const pbkdf2 = promisify(crypto.pbkdf2);

// OWASP Password Storage Cheat Sheet recommendation for PBKDF2-HMAC-SHA512.
const DIGEST = "sha512";
const ITERATIONS = 210_000;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

// Hashes produced before the versioned format existed: "<saltHex>:<hashHex>".
const LEGACY_ITERATIONS = 10_000;

export interface VerifyResult {
  valid: boolean;
  /** True when the stored hash uses outdated parameters and should be rewritten. */
  needsRehash: boolean;
}

/**
 * Hash a password as "pbkdf2$<digest>$<iterations>$<saltB64>$<hashB64>".
 * Embedding the parameters lets the cost be raised later without invalidating
 * existing hashes.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = (await pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)) as Buffer;
  return [
    "pbkdf2",
    DIGEST,
    ITERATIONS,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Verify a password against a stored hash in constant time.
 *
 * A missing or unparseable hash always fails: an account without a usable
 * credential cannot be signed into with a password.
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined
): Promise<VerifyResult> {
  if (!password || !storedHash) return { valid: false, needsRehash: false };

  let digest = DIGEST;
  let iterations = ITERATIONS;
  let salt: Buffer;
  let expected: Buffer;
  let legacy = false;

  if (storedHash.startsWith("pbkdf2$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 5) return { valid: false, needsRehash: false };
    digest = parts[1];
    iterations = parseInt(parts[2], 10);
    if (!Number.isFinite(iterations) || iterations <= 0) {
      return { valid: false, needsRehash: false };
    }
    salt = Buffer.from(parts[3], "base64");
    expected = Buffer.from(parts[4], "base64");
  } else if (storedHash.includes(":")) {
    const parts = storedHash.split(":");
    if (parts.length !== 2) return { valid: false, needsRehash: false };
    salt = Buffer.from(parts[0], "hex");
    expected = Buffer.from(parts[1], "hex");
    iterations = LEGACY_ITERATIONS;
    legacy = true;
  } else {
    // Anything else is not a credential we can verify. Notably, a bare string
    // is never compared against the password directly.
    return { valid: false, needsRehash: false };
  }

  if (expected.length === 0) return { valid: false, needsRehash: false };

  let derived: Buffer;
  try {
    derived = (await pbkdf2(password, salt, iterations, expected.length, digest)) as Buffer;
  } catch {
    return { valid: false, needsRehash: false };
  }

  const valid =
    derived.length === expected.length && crypto.timingSafeEqual(derived, expected);

  return {
    valid,
    needsRehash: valid && (legacy || iterations < ITERATIONS || digest !== DIGEST),
  };
}
