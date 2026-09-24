import { afterEach, describe, expect, it } from "vitest";
import { setting, settingOn } from "@/lib/env";

const names = ["TAMAM_TRUST_PROXY", "TRACKR_TRUST_PROXY"];
afterEach(() => {
  for (const n of names) delete process.env[n];
});

describe("settings after the rename to Tamam", () => {
  it("reads TAMAM_*, falls back to TRACKR_*, and prefers TAMAM_* when both are set", () => {
    expect(setting("TRUST_PROXY")).toBeUndefined();
    process.env.TRACKR_TRUST_PROXY = "1";
    expect(settingOn("TRUST_PROXY")).toBe(true);
    process.env.TAMAM_TRUST_PROXY = "0";
    expect(settingOn("TRUST_PROXY")).toBe(false);
  });

  it("treats an empty TAMAM_* as unset, as the compose file passes both", () => {
    process.env.TAMAM_TRUST_PROXY = "";
    process.env.TRACKR_TRUST_PROXY = "1";
    expect(settingOn("TRUST_PROXY")).toBe(true);
  });
});

describe("webhook headers after the rename", () => {
  it("sends the Tamam names and, for now, the Trackr ones too", async () => {
    const { webhookHeaders } = await import("@/lib/webhookHeaders");
    expect(webhookHeaders("issue:created", "d1")).toMatchObject({
      "User-Agent": "Tamam-Webhook-Engine/1.0",
      "X-Tamam-Event": "issue:created",
      "X-Tamam-Delivery": "d1",
      "X-Trackr-Event": "issue:created",
      "X-Trackr-Delivery": "d1",
    });
  });
});
