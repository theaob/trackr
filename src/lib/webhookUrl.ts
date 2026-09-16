import dns from "dns/promises";
import net from "net";

/**
 * Webhook URLs are operator-supplied but reach out from inside the network, so
 * they are checked against the ranges that make server-side request forgery
 * useful: loopback, link-local (including the cloud metadata address), and
 * private space.
 *
 * Set TRACKR_ALLOW_PRIVATE_WEBHOOKS=1 to permit them, for deployments whose
 * receivers genuinely live on the same private network.
 */
export function privateWebhooksAllowed(): boolean {
  return process.env.TRACKR_ALLOW_PRIVATE_WEBHOOKS === "1";
}

export function isBlockedAddress(address: string): boolean {
  const version = net.isIP(address);

  if (version === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;

    if (a === 0) return true; // "this" network
    if (a === 10) return true; // private
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a >= 224) return true; // multicast and reserved
    return false;
  }

  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("::ffff:")) {
      // IPv4-mapped address: judge it by its IPv4 form.
      return isBlockedAddress(lower.slice("::ffff:".length));
    }
    return false;
  }

  return false;
}

export interface UrlCheckResult {
  ok: boolean;
  error?: string;
}

/** Validate the shape of a webhook URL without resolving it. */
export function checkWebhookUrlShape(rawUrl: string): UrlCheckResult {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Valid HTTP or HTTPS URL is required" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Valid HTTP or HTTPS URL is required" };
  }

  if (!url.hostname) {
    return { ok: false, error: "Webhook URL must include a hostname" };
  }

  return { ok: true };
}

/**
 * Resolve the URL's host and reject it when it points somewhere internal.
 *
 * This is checked both when a webhook is saved and immediately before each
 * delivery, because DNS answers can change between the two.
 */
export async function checkWebhookUrl(rawUrl: string): Promise<UrlCheckResult> {
  const shape = checkWebhookUrlShape(rawUrl);
  if (!shape.ok) return shape;

  if (privateWebhooksAllowed()) return { ok: true };

  const hostname = new URL(rawUrl).hostname.replace(/^\[|\]$/g, "");

  let addresses: string[];
  if (net.isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      const resolved = await dns.lookup(hostname, { all: true });
      addresses = resolved.map((entry) => entry.address);
    } catch {
      return { ok: false, error: `Could not resolve webhook host "${hostname}"` };
    }
  }

  if (addresses.length === 0) {
    return { ok: false, error: `Could not resolve webhook host "${hostname}"` };
  }

  if (addresses.some(isBlockedAddress)) {
    return {
      ok: false,
      error:
        "Webhook URLs may not point at loopback, link-local or private addresses. " +
        "Set TRACKR_ALLOW_PRIVATE_WEBHOOKS=1 to allow them.",
    };
  }

  return { ok: true };
}
