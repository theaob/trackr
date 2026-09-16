import { describe, expect, it } from "vitest";
import { checkWebhookUrlShape, isBlockedAddress } from "@/lib/webhookUrl";

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "127.1.2.3",
    "0.0.0.0",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud instance metadata
    "100.64.0.1",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
  ])("blocks %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "2606:4700::1111"])(
    "allows %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    }
  );
});

describe("checkWebhookUrlShape", () => {
  it("accepts http and https URLs", () => {
    expect(checkWebhookUrlShape("https://example.com/hook").ok).toBe(true);
    expect(checkWebhookUrlShape("http://example.com/hook").ok).toBe(true);
  });

  it.each(["", "not-a-url", "ftp://example.com", "file:///etc/passwd", "javascript:alert(1)"])(
    "rejects %s",
    (url) => {
      expect(checkWebhookUrlShape(url).ok).toBe(false);
    }
  );
});
