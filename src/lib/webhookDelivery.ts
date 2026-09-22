import dns from "dns/promises";
import http from "http";
import https from "https";
import net from "net";
import type { LookupFunction } from "net";
import { isBlockedAddress, privateWebhooksAllowed } from "@/lib/webhookUrl";

export type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;

const systemResolver: Resolver = (hostname) => dns.lookup(hostname, { all: true });

export const BLOCKED_ADDRESS_ERROR =
  "Webhook URLs may not point at loopback, link-local or private addresses. " +
  "Set TRACKR_ALLOW_PRIVATE_WEBHOOKS=1 to allow them.";

/**
 * A connection-time DNS lookup that refuses internal addresses.
 *
 * Checking the host and then letting the HTTP client resolve it again leaves a
 * window for DNS rebinding: a name can answer with a public address for the
 * check and 127.0.0.1 for the connection. Doing the check inside the lookup
 * the socket itself uses means the address that was checked is the address
 * that gets connected to.
 */
export function guardedLookup(resolve: Resolver, allowPrivate: boolean): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname)
      .then((entries) => {
        if (entries.length === 0) throw new Error(`Could not resolve webhook host "${hostname}"`);
        if (!allowPrivate && entries.some((e) => isBlockedAddress(e.address))) {
          throw new Error(BLOCKED_ADDRESS_ERROR);
        }
        const wanted = options.family === 4 || options.family === 6 ? options.family : 0;
        const usable = wanted ? entries.filter((e) => e.family === wanted) : entries;
        if (usable.length === 0) throw new Error(`Could not resolve webhook host "${hostname}"`);
        // Node asks for every address when it races IPv4 and IPv6 connections.
        if (options.all) callback(null, usable);
        else callback(null, usable[0].address, usable[0].family);
      })
      .catch((err: NodeJS.ErrnoException) => callback(err, "", 0));
  };
}

export interface WebhookPostOptions {
  headers: Record<string, string>;
  timeoutMs?: number;
  /** Stop reading the response after this many bytes. */
  maxResponseBytes?: number;
  allowPrivate?: boolean;
  resolve?: Resolver;
}

/**
 * POST a webhook payload. Redirects are not followed (a redirect could point
 * anywhere), and only the start of the response body is read.
 */
export function postWebhook(
  rawUrl: string,
  body: string,
  {
    headers,
    timeoutMs = 8000,
    maxResponseBytes = 4096,
    allowPrivate = privateWebhooksAllowed(),
    resolve = systemResolver,
  }: WebhookPostOptions
): Promise<{ status: number; body: string }> {
  return new Promise((resolvePromise, reject) => {
    const url = new URL(rawUrl);
    const literal = url.hostname.replace(/^\[|\]$/g, "");
    // Sockets skip the lookup for IP literals, so check those here.
    if (net.isIP(literal) && !allowPrivate && isBlockedAddress(literal)) {
      reject(new Error(BLOCKED_ADDRESS_ERROR));
      return;
    }

    const client = url.protocol === "https:" ? https : http;
    const req = client.request(url, {
      method: "POST",
      headers: { ...headers, "Content-Length": Buffer.byteLength(body).toString() },
      lookup: guardedLookup(resolve, allowPrivate),
      timeout: timeoutMs,
    });

    const deadline = setTimeout(() => req.destroy(new Error("Request timed out")), timeoutMs);

    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", (err) => {
      clearTimeout(deadline);
      reject(err);
    });
    req.on("response", (res) => {
      const chunks: Buffer[] = [];
      let received = 0;
      const finish = () => {
        clearTimeout(deadline);
        resolvePromise({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).subarray(0, maxResponseBytes).toString("utf8"),
        });
      };
      res.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        received += chunk.length;
        if (received >= maxResponseBytes) {
          // Enough for the delivery log; don't download the rest.
          res.removeAllListeners("data");
          finish();
          res.destroy();
        }
      });
      res.on("end", finish);
      res.on("error", finish);
    });

    req.end(body);
  });
}
