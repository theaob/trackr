"use server";

import crypto from "crypto";
import prisma from "@/lib/db";
import { Webhook, WebhookDelivery, WebhookEvent } from "@/types";
import { revalidatePath } from "next/cache";

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
    const where: any = projectId
      ? { OR: [{ projectId }, { projectId: null }] }
      : {};

    const webhooks = await prisma.webhook.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return webhooks as unknown as Webhook[];
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
}) {
  try {
    const { name, url, secret, events, projectId } = data;

    if (!name || name.trim() === "") {
      return { success: false, error: "Webhook name is required" };
    }

    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return { success: false, error: "Valid HTTP or HTTPS URL is required" };
    }

    if (!events || events.length === 0) {
      return { success: false, error: "Please select at least one event trigger" };
    }

    const webhook = await prisma.webhook.create({
      data: {
        name: name.trim(),
        url: url.trim(),
        secret: secret?.trim() || null,
        events: JSON.stringify(events),
        enabled: true,
        projectId: projectId || null,
      },
    });

    return { success: true, webhook: webhook as unknown as Webhook };
  } catch (error: any) {
    console.error("Failed to create webhook:", error);
    return { success: false, error: error?.message || "Failed to create webhook" };
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
  }
) {
  try {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.url !== undefined) {
      if (!data.url.startsWith("http://") && !data.url.startsWith("https://")) {
        return { success: false, error: "Valid HTTP or HTTPS URL is required" };
      }
      updateData.url = data.url.trim();
    }
    if (data.secret !== undefined) updateData.secret = data.secret ? data.secret.trim() : null;
    if (data.events !== undefined) updateData.events = JSON.stringify(data.events);
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    const updated = await prisma.webhook.update({
      where: { id },
      data: updateData,
    });

    return { success: true, webhook: updated as unknown as Webhook };
  } catch (error: any) {
    console.error("Failed to update webhook:", error);
    return { success: false, error: error?.message || "Failed to update webhook" };
  }
}

/**
 * Delete a webhook and cascade delete all its deliveries
 */
export async function deleteWebhook(id: string) {
  try {
    await prisma.webhook.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete webhook:", error);
    return { success: false, error: error?.message || "Failed to delete webhook" };
  }
}

/**
 * Fetch delivery history for a webhook
 */
export async function getWebhookDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
  try {
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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Jira-Webhook-Engine/1.0",
    "X-Jira-Event": event,
    "X-Jira-Delivery": crypto.randomUUID(),
  };

  if (webhook.secret) {
    headers["X-Hub-Signature-256"] = computeHmacSignature(webhook.secret, payloadString);
  }

  let status = 0;
  let responseBody: string | null = null;
  let errorMsg: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    status = res.status;
    const text = await res.text();
    responseBody = text.slice(0, 1000); // Truncate to first 1000 chars
  } catch (err: any) {
    errorMsg = err?.message || "Request failed";
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
 * Trigger webhooks for a specific event across matching enabled webhooks.
 * Executes asynchronously without blocking the caller.
 */
export async function triggerWebhooks(
  event: WebhookEvent,
  data: any,
  projectId?: string
) {
  try {
    const where: any = {
      enabled: true,
      ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : {}),
    };

    const webhooks = await prisma.webhook.findMany({ where });

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      projectId: projectId || null,
      data,
    };

    // Filter webhooks that subscribe to this event
    const matchingWebhooks = webhooks.filter((wh) => {
      try {
        const events: string[] = JSON.parse(wh.events);
        return events.includes(event);
      } catch {
        return false;
      }
    });

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
    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) {
      return { success: false, status: 0, durationMs: 0, error: "Webhook not found" };
    }

    const testPayload = {
      event: "webhook:test" as WebhookEvent,
      timestamp: new Date().toISOString(),
      projectId: webhook.projectId,
      data: {
        message: "This is a test webhook trigger from Jira Clone",
        webhookId: webhook.id,
        webhookName: webhook.name,
      },
    };

    const result = await deliverWebhook(webhook, "webhook:test", testPayload);
    return result;
  } catch (error: any) {
    console.error("Failed to test webhook:", error);
    return {
      success: false,
      status: 0,
      durationMs: 0,
      error: error?.message || "Failed to test webhook",
    };
  }
}

