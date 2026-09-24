import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { verifyIdToken } from "@/lib/auth/oidc";

const SECRET = "shared-client-secret";

function sign(payload: object, secret = SECRET, alg = "HS256"): string {
  const header = Buffer.from(JSON.stringify({ alg, typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const digest = alg === "HS384" ? "sha384" : alg === "HS512" ? "sha512" : "sha256";
  const signature = crypto
    .createHmac(digest, secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

const now = () => Math.floor(Date.now() / 1000);

function claims(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://idp.example.com",
    aud: "tamam-client",
    sub: "subject-1",
    email: "person@example.com",
    exp: now() + 300,
    iat: now(),
    ...overrides,
  };
}

describe("verifyIdToken", () => {
  it("accepts a correctly signed token", () => {
    const result = verifyIdToken(sign(claims({ nonce: "n1" })), {
      clientSecret: SECRET,
      expectedIssuer: "https://idp.example.com",
      expectedAudience: "tamam-client",
      expectedNonce: "n1",
    });
    expect(result.valid).toBe(true);
  });

  // The endpoint used to accept an identity straight from the request body.
  it("rejects an unsigned token", () => {
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(claims())).toString("base64url");
    const result = verifyIdToken(`${header}.${body}.`, { clientSecret: SECRET });
    expect(result).toMatchObject({ valid: false });
  });

  it("rejects a token signed with the wrong secret", () => {
    const result = verifyIdToken(sign(claims(), "attacker-secret"), {
      clientSecret: SECRET,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const token = sign(claims());
    const [header, , signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify(claims({ email: "admin@example.com" }))
    ).toString("base64url");
    const result = verifyIdToken(`${header}.${forged}.${signature}`, {
      clientSecret: SECRET,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects an expired token", () => {
    const result = verifyIdToken(sign(claims({ exp: now() - 3600 })), {
      clientSecret: SECRET,
    });
    expect(result).toMatchObject({ valid: false, error: "ID token has expired." });
  });

  it("rejects a token with no expiry", () => {
    const withoutExp = claims();
    delete (withoutExp as any).exp;
    expect(verifyIdToken(sign(withoutExp), { clientSecret: SECRET }).valid).toBe(false);
  });

  it("rejects a mismatched issuer, audience or nonce", () => {
    expect(
      verifyIdToken(sign(claims({ iss: "https://evil.example.com" })), {
        clientSecret: SECRET,
        expectedIssuer: "https://idp.example.com",
      }).valid
    ).toBe(false);

    expect(
      verifyIdToken(sign(claims({ aud: "other-client" })), {
        clientSecret: SECRET,
        expectedAudience: "tamam-client",
      }).valid
    ).toBe(false);

    expect(
      verifyIdToken(sign(claims({ nonce: "wrong" })), {
        clientSecret: SECRET,
        expectedNonce: "expected",
      }).valid
    ).toBe(false);
  });

  it("accepts an audience array containing the client id", () => {
    const result = verifyIdToken(sign(claims({ aud: ["other", "tamam-client"] })), {
      clientSecret: SECRET,
      expectedAudience: "tamam-client",
    });
    expect(result.valid).toBe(true);
  });

  it("refuses to verify when no key material is configured", () => {
    expect(verifyIdToken(sign(claims()), {}).valid).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(verifyIdToken("", { clientSecret: SECRET }).valid).toBe(false);
    expect(verifyIdToken("a.b", { clientSecret: SECRET }).valid).toBe(false);
    expect(verifyIdToken("a.b.c", { clientSecret: SECRET }).valid).toBe(false);
  });

  it("rejects an unsupported algorithm", () => {
    const header = Buffer.from(JSON.stringify({ alg: "XX999" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(claims())).toString("base64url");
    expect(
      verifyIdToken(`${header}.${body}.sig`, { clientSecret: SECRET }).valid
    ).toBe(false);
  });
});

describe("verifyIdToken with RS256", () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

  it("refuses an RS256 token when no signing certificate is configured", () => {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
      "base64url"
    );
    const body = Buffer.from(JSON.stringify(claims())).toString("base64url");
    const signature = crypto
      .sign("sha256", Buffer.from(`${header}.${body}`), privateKey)
      .toString("base64url");

    // A client secret must not stand in for the certificate an RS256 token
    // needs: that would accept any token the caller cared to sign.
    const result = verifyIdToken(`${header}.${body}.${signature}`, {
      clientSecret: SECRET,
    });
    expect(result).toMatchObject({ valid: false });
  });

  it("rejects an RS256 token against a certificate that is not a certificate", () => {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
      "base64url"
    );
    const body = Buffer.from(JSON.stringify(claims())).toString("base64url");
    const result = verifyIdToken(`${header}.${body}.c2ln`, {
      certificatePem: "-----BEGIN CERTIFICATE-----\nnot-a-certificate\n-----END CERTIFICATE-----",
    });
    expect(result.valid).toBe(false);
  });
});
