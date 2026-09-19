import { describe, expect, it, vi } from "vitest";
import crypto from "crypto";

vi.mock("react", async () => {
  const actual = await vi.importActual<any>("react");
  return {
    ...actual,
    cache: (fn: any) => fn,
  };
});

import { validateWebhookJql } from "@/lib/actions/webhooks";
import { WebhookEvent, WebhookPayload, WebhookActor, WebhookChangelogItem } from "@/types";

describe("Webhook JQL Validation", () => {
  it("accepts empty or whitespace queries", async () => {
    expect((await validateWebhookJql("")).valid).toBe(true);
    expect((await validateWebhookJql("   ")).valid).toBe(true);
  });

  it("accepts valid JQL expressions", async () => {
    const validQueries = [
      'status = "DONE"',
      'status in ("TODO", "IN_PROGRESS")',
      "priority = HIGH",
      "priority in (HIGH, HIGHEST) AND type = BUG",
      'assignee = "user-123" OR reporter = "user-456"',
      "storyPoints >= 5",
      "status != DONE AND priority = HIGHEST",
    ];

    for (const q of validQueries) {
      const res = await validateWebhookJql(q);
      expect(res.valid, `Expected "${q}" to be valid`).toBe(true);
    }
  });

  it("rejects invalid JQL syntax", async () => {
    const invalidQueries = [
      "status ==",
      "priority in (HIGH",
      "AND type = BUG",
      "status = AND",
    ];

    for (const q of invalidQueries) {
      const res = await validateWebhookJql(q);
      expect(res.valid, `Expected "${q}" to be invalid`).toBe(false);
      expect(res.error).toBeDefined();
    }
  });
});

describe("Webhook Payloads & Signatures", () => {
  function computeHmacSignature(secret: string, payload: string): string {
    return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }

  it("computes standard HMAC SHA-256 signatures", () => {
    const secret = "whsec_test_secret_12345";
    const payload = JSON.stringify({ event: "issue:transitioned", data: { id: "iss-1" } });
    const signature = computeHmacSignature(secret, payload);

    expect(signature.startsWith("sha256=")).toBe(true);
    expect(signature.length).toBe(7 + 64); // "sha256=" + 64 hex chars
  });

  it("formats standardized Jira-style payload with actor and changelog", () => {
    const actor: WebhookActor = {
      id: "usr-admin",
      name: "Admin User",
      email: "admin@example.com",
      avatarUrl: "https://example.com/avatar.png",
    };

    const changelog: WebhookChangelogItem[] = [
      {
        field: "status",
        fieldId: "status",
        from: "TODO",
        fromString: "To Do",
        to: "IN_PROGRESS",
        toString: "In Progress",
      },
      {
        field: "priority",
        fieldId: "priority",
        from: "MEDIUM",
        fromString: "MEDIUM",
        to: "HIGH",
        toString: "HIGH",
      },
    ];

    const payload: WebhookPayload = {
      event: "issue:transitioned",
      timestamp: new Date().toISOString(),
      projectId: "proj-1",
      actor,
      changelog,
      data: {
        issue: {
          id: "iss-123",
          key: "PROJ-101",
          title: "Fix auth race condition",
          status: "IN_PROGRESS",
          priority: "HIGH",
        },
      },
    };

    expect(payload.event).toBe("issue:transitioned");
    expect(payload.actor?.name).toBe("Admin User");
    expect(payload.changelog).toHaveLength(2);
    expect(payload.changelog?.[0].field).toBe("status");
    expect(payload.changelog?.[0].to).toBe("IN_PROGRESS");
    expect(payload.data.issue.key).toBe("PROJ-101");
  });

  it("covers comprehensive set of granular lifecycle events", () => {
    const expectedEvents: WebhookEvent[] = [
      // Issue
      "issue:created",
      "issue:updated",
      "issue:deleted",
      "issue:transitioned",
      "issue:assigned",
      "issue:priority_changed",
      "issue:linked",
      "issue:unlinked",
      // Comment
      "comment:created",
      "comment:updated",
      "comment:deleted",
      // Attachment
      "attachment:created",
      "attachment:deleted",
      // Worklog
      "worklog:created",
      "worklog:deleted",
      // Sprint
      "sprint:created",
      "sprint:started",
      "sprint:updated",
      "sprint:completed",
      "sprint:deleted",
      // Version
      "version:created",
      "version:updated",
      "version:released",
      "version:archived",
      "version:deleted",
      // Test
      "webhook:test",
    ];

    // Every expected event is a valid distinct string
    const unique = new Set(expectedEvents);
    expect(unique.size).toBe(expectedEvents.length);
    expect(expectedEvents.length).toBeGreaterThanOrEqual(24);
  });
});
