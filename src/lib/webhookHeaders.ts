/**
 * The headers every delivery carries. Since the rename to Tamam they are
 * X-Tamam-*; the X-Trackr-* names are sent as well until 0.44.0 so existing
 * receivers keep working.
 */
export function webhookHeaders(event: string, deliveryId: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Agent": "Tamam-Webhook-Engine/1.0",
    "X-Tamam-Event": event,
    "X-Tamam-Delivery": deliveryId,
    "X-Trackr-Event": event,
    "X-Trackr-Delivery": deliveryId,
  };
}
