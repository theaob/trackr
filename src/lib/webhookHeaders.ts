/** The headers every delivery carries. */
export function webhookHeaders(event: string, deliveryId: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Agent": "Tamam-Webhook-Engine/1.0",
    "X-Tamam-Event": event,
    "X-Tamam-Delivery": deliveryId,
  };
}
