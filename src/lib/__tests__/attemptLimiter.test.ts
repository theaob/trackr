import { describe, expect, it } from "vitest";
import { AttemptLimiter, clientAddressFrom, tooManyAttemptsMessage } from "@/lib/auth/attemptLimiter";

const MINUTE = 60_000;

describe("AttemptLimiter", () => {
  it("allows attempts until the failure limit, then refuses", () => {
    const limiter = new AttemptLimiter(3, 15 * MINUTE);
    for (let i = 0; i < 3; i++) {
      expect(limiter.retryAfterMs("a", 1000)).toBe(0);
      limiter.recordFailure("a", 1000);
    }
    expect(limiter.retryAfterMs("a", 1000)).toBe(15 * MINUTE);
  });

  it("lets a key try again once its oldest counted failure leaves the window", () => {
    const limiter = new AttemptLimiter(2, 10 * MINUTE);
    limiter.recordFailure("a", 0);
    limiter.recordFailure("a", 4 * MINUTE);
    expect(limiter.retryAfterMs("a", 6 * MINUTE)).toBe(4 * MINUTE);
    expect(limiter.retryAfterMs("a", 10 * MINUTE)).toBe(0);
  });

  it("counts keys separately and forgets a key on reset", () => {
    const limiter = new AttemptLimiter(1, MINUTE);
    limiter.recordFailure("a", 0);
    expect(limiter.retryAfterMs("a", 0)).toBeGreaterThan(0);
    expect(limiter.retryAfterMs("b", 0)).toBe(0);
    limiter.reset("a");
    expect(limiter.retryAfterMs("a", 0)).toBe(0);
  });

  it("keeps memory bounded by dropping the least recently failing keys", () => {
    const limiter = new AttemptLimiter(1, MINUTE, 2);
    limiter.recordFailure("old", 0);
    limiter.recordFailure("newer", 1);
    limiter.recordFailure("newest", 2);
    expect(limiter.retryAfterMs("old", 3)).toBe(0);
    expect(limiter.retryAfterMs("newest", 3)).toBeGreaterThan(0);
  });
});

describe("clientAddressFrom", () => {
  const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n] ?? null });

  it("ignores forwarding headers unless a proxy is trusted", () => {
    expect(clientAddressFrom(headers({ "x-forwarded-for": "1.2.3.4" }), false)).toBeNull();
  });

  it("uses the first forwarded address behind a trusted proxy", () => {
    expect(clientAddressFrom(headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }), true)).toBe("1.2.3.4");
    expect(clientAddressFrom(headers({ "x-real-ip": "5.6.7.8" }), true)).toBe("5.6.7.8");
    expect(clientAddressFrom(headers({}), true)).toBeNull();
  });
});

describe("tooManyAttemptsMessage", () => {
  it("rounds up to whole minutes", () => {
    expect(tooManyAttemptsMessage(1)).toBe("Too many failed attempts. Try again in 1 minute.");
    expect(tooManyAttemptsMessage(14 * MINUTE + 1)).toBe("Too many failed attempts. Try again in 15 minutes.");
  });
});
