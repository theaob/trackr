import http from "http";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BLOCKED_ADDRESS_ERROR, postWebhook, type Resolver } from "@/lib/webhookDelivery";

// A real receiver on loopback, reached through a fake hostname whose DNS
// answers each test controls.
let server: http.Server;
let port: number;
let hits: number;
let responseBody = "ok";

beforeAll(async () => {
  server = http.createServer((req, res) => {
    hits++;
    req.resume();
    req.on("end", () => res.end(responseBody));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  hits = 0;
  responseBody = "ok";
});

const loopback: Resolver = async () => [{ address: "127.0.0.1", family: 4 }];
const headers = { "Content-Type": "application/json" };

describe("postWebhook", () => {
  it("refuses a host that resolves to an internal address at connection time", async () => {
    await expect(
      postWebhook(`http://hooks.example.test:${port}/`, "{}", { headers, allowPrivate: false, resolve: loopback })
    ).rejects.toThrow(BLOCKED_ADDRESS_ERROR);
    expect(hits).toBe(0);
  });

  it("connects to the address it checked, not to a second DNS answer (rebinding)", async () => {
    // Public on the first lookup, loopback on any later one.
    let lookups = 0;
    const rebinding: Resolver = async () =>
      lookups++ === 0 ? [{ address: "203.0.113.10", family: 4 }] : [{ address: "127.0.0.1", family: 4 }];

    await expect(
      postWebhook(`http://rebind.example.test:${port}/`, "{}", {
        headers,
        allowPrivate: false,
        resolve: rebinding,
        timeoutMs: 300,
      })
    ).rejects.toThrow();
    expect(lookups).toBe(1);
    expect(hits).toBe(0);
  });

  it("refuses internal IP literals", async () => {
    await expect(
      postWebhook(`http://127.0.0.1:${port}/`, "{}", { headers, allowPrivate: false })
    ).rejects.toThrow(BLOCKED_ADDRESS_ERROR);
    expect(hits).toBe(0);
  });

  it("delivers when private receivers are allowed, and reads only the start of the response", async () => {
    responseBody = "x".repeat(1_000_000);
    const res = await postWebhook(`http://hooks.example.test:${port}/`, "{}", {
      headers,
      allowPrivate: true,
      resolve: loopback,
      maxResponseBytes: 4096,
    });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(4096);
    expect(hits).toBe(1);
  });
});
