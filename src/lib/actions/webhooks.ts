"use server";

import crypto from "crypto";
import prisma from "@/lib/db";
import { Webhook, WebhookActor, WebhookChangelogItem, WebhookDelivery, WebhookEvent, WebhookPayload } from "@/types";
import { revalidatePath } from "next/cache";
import {
  AuthError,
  isCurrentUserInstanceAdmin,
  requireInstanceAdmin,
  requireProjectPermission,
  toActionError,
} from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { checkWebhookUrl } from "@/lib/webhookUrl";
import { postWebhook } from "@/lib/webhookDelivery";
import { TQLParser } from "@/lib/tql/parser";
import { TQLCompiler } from "@/lib/tql/compiler";

/**
 * A webhook is administered by the project it belongs to. Instance-wide
 * webhooks (no project) receive events from every project, so they are
 * restricted to instance administrators.
 */
async function requireWebhookAdmin(projectId: string | null | undefined) {
  if (projectId) {
    await requireProjectPermission(projectId, "PROJECT_ADMIN");
    return;
  }
  await requireInstanceAdmin();
}

async function requireWebhookAdminById(webhookId: string) {
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId },
    select: { projectId: true },
  });
  if (!webhook) throw new AuthError("Webhook not found.", 404);
  await requireWebhookAdmin(webhook.projectId);
  return webhook;
}

/** The signing secret never leaves the server; only its presence is reported. */
function toClientWebhook(webhook: {
  secret: string | null;
  [key: string]: unknown;
}) {
  const { secret, ...rest } = webhook;
  return { ...rest, secret: null, hasSecret: !!secret } as unknown as Webhook;
}

/**
 * Calculate HMAC SHA-256 signature for payload
 */
function computeHmacSignature(secret: string, payload: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Fetch all webhooks for a project (and global ones)
 */
export async function getProjectWebhooks(projectId?: string): Promise<Webhook[]> {
  try {
    await requireWebhookAdmin(projectId);

    // A global webhook's URL is often a secret in itself (a Slack incoming
    // webhook, for one), so a project admin sees only their project's hooks.
    const includeGlobal = !projectId || (await isCurrentUserInstanceAdmin());
    const where: any = projectId
      ? includeGlobal
        ? { OR: [{ projectId }, { projectId: null }] }
        : { projectId }
      : { projectId: null };

    const webhooks = await prisma.webhook.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return webhooks.map(toClientWebhook);
  } catch (error) {
    console.error("Failed to fetch webhooks:", error);
    return [];
  }
}

/**
 * Create a new webhook
 */
export async function createWebhook(data: {
  name: string;
  url: string;
  secret?: string;
  events: WebhookEvent[];
  projectId?: string;
  jqlFilter?: string | null;
}) {
  try {
    const { name, url, secret, events, projectId, jqlFilter } = data;
    await requireWebhookAdmin(projectId);

    if (!name || name.trim() === "") {
      return { success: false, error: "Webhook name is required" };
    }

    const urlCheck = await checkWebhookUrl(url?.trim() || "");
    if (!urlCheck.ok) {
      return { success: false, error: urlCheck.error! };
    }

    if (!events || events.length === 0) {
      return { success: false, error: "Please select at least one event trigger" };
    }

    if (jqlFilter && jqlFilter.trim()) {
      const parsed = TQLParser.parse(jqlFilter.trim());
      if (!parsed.success) {
        return { success: false, error: `Invalid JQL filter: ${parsed.error.message}` };
      }
    }

    const webhook = await prisma.webhook.create({
      data: {
        name: name.trim(),
        url: url.trim(),
        secret: secret?.trim() || null,
        events: JSON.stringify(events),
        enabled: true,
        projectId: projectId || null,
        jqlFilter: jqlFilter?.trim() || null,
      },
    });

    return { success: true as const, webhook: toClientWebhook(webhook) };
  } catch (error) {
    return toActionError(error, "Failed to create webhook");
  }
}

/**
 * Update a webhook's configuration or status
 */
export async function updateWebhook(
  id: string,
  data: {
    name?: string;
    url?: string;
    secret?: string | null;
    events?: WebhookEvent[];
    enabled?: boolean;
    jqlFilter?: string | null;
  }
) {
  try {
    await requireWebhookAdminById(id);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.url !== undefined) {
      const urlCheck = await checkWebhookUrl(data.url.trim());
      if (!urlCheck.ok) {
        return { success: false, error: urlCheck.error! };
      }
      updateData.url = data.url.trim();
    }
    if (data.secret !== undefined) updateData.secret = data.secret ? data.secret.trim() : null;
    if (data.events !== undefined) updateData.events = JSON.stringify(data.events);
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.jqlFilter !== undefined) {
      if (data.jqlFilter && data.jqlFilter.trim()) {
        const parsed = TQLParser.parse(data.jqlFilter.trim());
        if (!parsed.success) {
          return { success: false, error: `Invalid JQL filter: ${parsed.error.message}` };
        }
        updateData.jqlFilter = data.jqlFilter.trim();
      } else {
        updateData.jqlFilter = null;
      }
    }

    const updated = await prisma.webhook.update({
      where: { id },
      data: updateData,
    });

    return { success: true as const, webhook: toClientWebhook(updated) };
  } catch (error) {
    return toActionError(error, "Failed to update webhook");
  }
}

/**
 * Delete a webhook and cascade delete all its deliveries
 */
export async function deleteWebhook(id: string) {
  try {
    await requireWebhookAdminById(id);
    await prisma.webhook.delete({ where: { id } });
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to delete webhook");
  }
}

/**
 * Fetch delivery history for a webhook
 */
export async function getWebhookDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
  try {
    await requireWebhookAdminById(webhookId);

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    return deliveries as unknown as WebhookDelivery[];
  } catch (error) {
    console.error("Failed to fetch webhook deliveries:", error);
    return [];
  }
}

/**
 * Internal worker to deliver a single webhook request and record the delivery log
 */
async function deliverWebhook(
  webhook: { id: string; url: string; secret: string | null },
  event: WebhookEvent,
  payload: any
) {
  const startTime = Date.now();
  const payloadString = JSON.stringify(payload);

  const deliveryId = crypto.randomUUID();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Trackr-Webhook-Engine/1.0",
    "X-Trackr-Event": event,
    "X-Trackr-Delivery": deliveryId,
    "X-Jira-Event": event,
    "X-Jira-Delivery": deliveryId,
  };

  if (webhook.secret) {
    headers["X-Hub-Signature-256"] = computeHmacSignature(webhook.secret, payloadString);
  }

  let status = 0;
  let responseBody: string | null = null;
  let errorMsg: string | null = null;

  // Re-check at delivery time: the host may resolve differently now than it
  // did when the webhook was saved. postWebhook repeats the check on the very
  // address it connects to, which is what actually stops DNS rebinding; this
  // one just gives a clearer error for a URL that's plainly not allowed.
  const urlCheck = await checkWebhookUrl(webhook.url);

  if (!urlCheck.ok) {
    errorMsg = urlCheck.error || "Webhook URL is not allowed";
  } else {
    try {
      const res = await postWebhook(webhook.url, payloadString, { headers, timeoutMs: 8000 });
      status = res.status;
      responseBody = res.body.slice(0, 1000); // Truncate to first 1000 chars
    } catch (err: any) {
      errorMsg = err?.message || "Request failed";
    }
  }

  const durationMs = Date.now() - startTime;
  const isSuccess = status >= 200 && status < 300;

  try {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        url: webhook.url,
        status,
        success: isSuccess,
        durationMs,
        requestPayload: payloadString,
        responseBody,
        error: errorMsg,
      },
    });

    return {
      success: isSuccess,
      status,
      durationMs,
      error: errorMsg,
      responseBody,
      deliveryId: delivery.id,
    };
  } catch (dbErr) {
    console.error("Failed to log webhook delivery:", dbErr);
    return {
      success: isSuccess,
      status,
      durationMs,
      error: errorMsg,
      responseBody,
    };
  }
}

/**
 * Helper to test if an issue event matches a webhook's JQL filter.
 */
async function matchesJqlFilter(
  jqlFilter: string | null | undefined,
  event: WebhookEvent,
  issueId: string | null | undefined,
  projectId?: string | null
): Promise<boolean> {
  if (!jqlFilter || !jqlFilter.trim()) return true;

  // JQL filters in Jira specifically filter issue-related entities
  const isIssueRelated =
    event.startsWith("issue:") ||
    event.startsWith("comment:") ||
    event.startsWith("attachment:") ||
    event.startsWith("worklog:");

  if (!isIssueRelated) {
    return true;
  }

  // Issue was deleted, cannot evaluate post-delete in DB
  if (event === "issue:deleted") {
    return true;
  }

  if (!issueId) {
    return true;
  }

  try {
    const parsed = TQLParser.parse(jqlFilter.trim());
    if (!parsed.success) {
      console.warn("Invalid JQL filter in webhook:", parsed.error.message);
      return false;
    }
    const compiler = new TQLCompiler({
      accessibleProjectIds: projectId ? [projectId] : undefined,
    });
    const compiled = compiler.compile(parsed.query);

    const match = await prisma.issue.findFirst({
      where: {
        AND: [{ id: issueId }, compiled.where],
      },
      select: { id: true },
    });

    return !!match;
  } catch (err) {
    console.warn("Failed to evaluate JQL filter on webhook:", err);
    return false;
  }
}

export interface TriggerWebhookOptions {
  actor?: WebhookActor | null;
  changelog?: WebhookChangelogItem[] | null;
  issueId?: string | null;
}

/**
 * Trigger webhooks for a specific event across matching enabled webhooks.
 * Executes asynchronously without blocking the caller.
 */
export async function triggerWebhooks(
  event: WebhookEvent,
  data: any,
  projectId?: string | null,
  options?: TriggerWebhookOptions
) {
  try {
    const where: any = {
      enabled: true,
      ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : {}),
    };

    const webhooks = await prisma.webhook.findMany({ where });

    const targetIssueId =
      options?.issueId ||
      (data?.id && event.startsWith("issue:") ? data.id : undefined) ||
      (data?.issue?.id ? data.issue.id : undefined) ||
      data?.issueId ||
      undefined;

    let actor = options?.actor;
    if (!actor) {
      try {
        const user = await getCurrentUser();
        if (user) {
          actor = {
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
          };
        }
      } catch {}
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      projectId: projectId || null,
      actor: actor || null,
      changelog: options?.changelog || null,
      data,
    };

    // Filter webhooks that subscribe to this event
    const subscribedWebhooks = webhooks.filter((wh) => {
      try {
        const events: string[] = JSON.parse(wh.events);
        return events.includes(event);
      } catch {
        return false;
      }
    });

    // Check JQL filters for subscribed webhooks
    const filterResults = await Promise.all(
      subscribedWebhooks.map(async (wh) => ({
        wh,
        matches: await matchesJqlFilter(wh.jqlFilter, event, targetIssueId, wh.projectId || projectId),
      }))
    );
    const matchingWebhooks = filterResults.filter((r) => r.matches).map((r) => r.wh);

    // Fire deliveries in parallel (unawaited to avoid blocking response)
    Promise.allSettled(
      matchingWebhooks.map((wh) => deliverWebhook(wh, event, payload))
    ).catch((err) => console.error("Error dispatching webhooks:", err));

    return { dispatched: matchingWebhooks.length };
  } catch (error) {
    console.error("Failed to trigger webhooks:", error);
    return { dispatched: 0 };
  }
}

/**
 * Validate JQL query string for webhook filters
 */
export async function validateWebhookJql(query: string): Promise<{ valid: boolean; error?: string }> {
  if (!query || !query.trim()) return { valid: true };
  const parsed = TQLParser.parse(query.trim());
  if (!parsed.success) {
    return { valid: false, error: parsed.error.message };
  }
  return { valid: true };
}

/**
 * Test a webhook with a ping payload
 */
export async function testWebhook(webhookId: string): Promise<{
  success: boolean;
  status: number;
  durationMs: number;
  error?: string | null;
  responseBody?: string | null;
  deliveryId?: string;
}> {
  try {
    await requireWebhookAdminById(webhookId);

    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) {
      return { success: false, status: 0, durationMs: 0, error: "Webhook not found" };
    }

    let actor: WebhookActor | null = null;
    try {
      const user = await getCurrentUser();
      if (user) {
        actor = {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        };
      }
    } catch {}

    const testPayload: WebhookPayload = {
      event: "webhook:test",
      timestamp: new Date().toISOString(),
      projectId: webhook.projectId,
      actor,
      changelog: null,
      data: {
        message: "This is a test webhook trigger from Trackr",
        webhookId: webhook.id,
        webhookName: webhook.name,
        jqlFilter: webhook.jqlFilter,
      },
    };

    const result = await deliverWebhook(webhook, "webhook:test", testPayload);
    return result;
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, status: 0, durationMs: 0, error: error.message };
    }
    console.error("Failed to test webhook:", error);
    return {
      success: false,
      status: 0,
      durationMs: 0,
      error: "Failed to test webhook",
    };
  }
}

