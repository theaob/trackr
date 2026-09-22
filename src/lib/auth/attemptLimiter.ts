/**
 * Counts recent failures per key (an account, a client address) and refuses
 * further attempts once a key has failed `maxFailures` times within
 * `windowMs`. Only failures count, so normal use never trips it.
 *
 * In-memory by design: Trackr runs as a single process on SQLite, so there
 * is no second instance to share counts with. The number of tracked keys is
 * capped so that guessing at random emails or addresses can't grow memory
 * without bound; the least recently failing keys are dropped first.
 */
export class AttemptLimiter {
  private failures = new Map<string, number[]>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000
  ) {}

  private recent(key: string, now: number): number[] {
    const times = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (times.length === 0) this.failures.delete(key);
    else this.failures.set(key, times);
    return times;
  }

  /** How long until `key` may try again, in ms; 0 when it may try now. */
  retryAfterMs(key: string, now = Date.now()): number {
    const times = this.recent(key, now);
    if (times.length < this.maxFailures) return 0;
    const oldestCounted = times[times.length - this.maxFailures];
    return oldestCounted + this.windowMs - now;
  }

  recordFailure(key: string, now = Date.now()): void {
    const times = this.recent(key, now);
    // Re-insert so the Map's order tracks recency, for eviction below.
    this.failures.delete(key);
    this.failures.set(key, [...times, now]);
    while (this.failures.size > this.maxKeys) {
      const oldest = this.failures.keys().next().value as string;
      this.failures.delete(oldest);
    }
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}

/**
 * The client's address from forwarding headers, or null when it can't be
 * trusted. Without a reverse proxy vouching for them (TRACKR_TRUST_PROXY=1,
 * the same switch the session cookie's Secure flag uses) these headers are
 * whatever the client chose to send, so they're ignored.
 */
export function clientAddressFrom(
  headers: { get(name: string): string | null },
  trustProxy = process.env.TRACKR_TRUST_PROXY === "1"
): string | null {
  if (!trustProxy) return null;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || null;
}

export function tooManyAttemptsMessage(retryAfterMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Kept on globalThis so a dev-server reload doesn't wipe the counts.
const limiters = globalThis as unknown as {
  trackrSignInByAccount?: AttemptLimiter;
  trackrSignInByClient?: AttemptLimiter;
  trackrTokenByClient?: AttemptLimiter;
};

/** Per account: stops guessing one person's password, wherever it comes from. */
export const signInByAccount = (limiters.trackrSignInByAccount ??= new AttemptLimiter(10, FIFTEEN_MINUTES));
/** Per client address (when known): stops one client guessing across accounts. */
export const signInByClient = (limiters.trackrSignInByClient ??= new AttemptLimiter(30, FIFTEEN_MINUTES));
/** Per client address (when known): invalid API tokens. */
export const tokenByClient = (limiters.trackrTokenByClient ??= new AttemptLimiter(30, FIFTEEN_MINUTES));
