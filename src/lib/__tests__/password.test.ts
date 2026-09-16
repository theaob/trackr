import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("round-trips a password", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored.startsWith("pbkdf2$sha512$210000$")).toBe(true);
    expect((await verifyPassword("correct horse battery", stored)).valid).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const stored = await hashPassword("correct horse battery");
    expect((await verifyPassword("wrong", stored)).valid).toBe(false);
  });

  it("uses a fresh salt for each hash", async () => {
    const [a, b] = await Promise.all([hashPassword("same"), hashPassword("same")]);
    expect(a).not.toEqual(b);
  });

  // An account with no usable credential must not be signable into. This is
  // the bug that let anyone log in as any seeded user.
  it.each([null, undefined, ""])("fails closed for a missing hash (%s)", async (stored) => {
    expect((await verifyPassword("anything", stored as any)).valid).toBe(false);
  });

  it("never compares the password against the stored value directly", async () => {
    expect((await verifyPassword("secret", "secret")).valid).toBe(false);
  });

  it("rejects an empty password even against a valid hash", async () => {
    const stored = await hashPassword("something");
    expect((await verifyPassword("", stored)).valid).toBe(false);
  });

  it("rejects a malformed stored hash", async () => {
    expect((await verifyPassword("pw", "pbkdf2$sha512$nope")).valid).toBe(false);
    expect((await verifyPassword("pw", "$$$$")).valid).toBe(false);
  });

  it("accepts a legacy hash and asks for a rehash", async () => {
    const salt = crypto.randomBytes(16);
    const legacy = `${salt.toString("hex")}:${crypto
      .pbkdf2Sync("legacy-pw", salt, 10_000, 64, "sha512")
      .toString("hex")}`;

    const result = await verifyPassword("legacy-pw", legacy);
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(true);
  });

  it("does not ask for a rehash of a current hash", async () => {
    const result = await verifyPassword("pw", await hashPassword("pw"));
    expect(result).toEqual({ valid: true, needsRehash: false });
  });
});
