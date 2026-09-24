import { afterEach, describe, expect, it } from "vitest";
import { setting, settingOn } from "@/lib/env";

afterEach(() => {
  delete process.env.TAMAM_TRUST_PROXY;
});

describe("settings", () => {
  it("reads TAMAM_*", () => {
    expect(setting("TRUST_PROXY")).toBeUndefined();
    process.env.TAMAM_TRUST_PROXY = "1";
    expect(settingOn("TRUST_PROXY")).toBe(true);
    process.env.TAMAM_TRUST_PROXY = "0";
    expect(settingOn("TRUST_PROXY")).toBe(false);
  });

  it("treats an empty value as unset", () => {
    process.env.TAMAM_TRUST_PROXY = "";
    expect(setting("TRUST_PROXY")).toBeUndefined();
  });
});

describe("webhook headers", () => {
  it("sends the Tamam names only", async () => {
    const { webhookHeaders } = await import("@/lib/webhookHeaders");
    const headers = webhookHeaders("issue:created", "d1");
    expect(headers).toMatchObject({
      "User-Agent": "Tamam-Webhook-Engine/1.0",
      "X-Tamam-Event": "issue:created",
      "X-Tamam-Delivery": "d1",
    });
    expect(Object.keys(headers).filter((h) => !/^(Content-Type|User-Agent|X-Tamam-)/.test(h))).toEqual([]);
  });
});
