"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Webhook, WebhookDelivery } from "@/types";
import { getWebhookDeliveries, testWebhook } from "@/lib/actions/webhooks";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import {
  History,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Clock,
  Code2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface WebhookDeliveriesModalProps {
  webhook: Webhook | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function WebhookDeliveriesModal({
  webhook,
  isOpen,
  onClose,
}: WebhookDeliveriesModalProps) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);

  const webhookId = webhook?.id;
  // Ignores a slow response for a webhook the modal has since moved away from.
  const latestRequest = useRef(0);
  const loadDeliveries = useCallback(async () => {
    if (!webhookId) return;
    const request = ++latestRequest.current;
    setIsLoading(true);
    try {
      const data = await getWebhookDeliveries(webhookId);
      if (request !== latestRequest.current) return;
      setDeliveries(data);
      if (data.length > 0) {
        setExpandedDeliveryId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (request === latestRequest.current) setIsLoading(false);
    }
  }, [webhookId]);

  useEffect(() => {
    if (!isOpen) return;
    loadDeliveries();
  }, [isOpen, loadDeliveries]);

  const handleTestPing = async () => {
    if (!webhook) return;
    setIsTesting(true);
    try {
      await testWebhook(webhook.id);
      await loadDeliveries();
    } catch (err) {
      console.error(err);
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen || !webhook) return null;

  const toggleExpand = (id: string) => {
    setExpandedDeliveryId((prev) => (prev === id ? null : id));
  };

  const formatPayload = (raw: string) => {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="xl"
        title={`Deliveries: ${webhook.name}`}
        description={<span className="break-all font-mono text-xs">{webhook.url}</span>}
        footer={
          <>
            <Button onClick={onClose}>Close</Button>
            <Button variant="primary" onClick={handleTestPing} loading={isTesting}>
              {!isTesting && <Send className="h-3.5 w-3.5" aria-hidden="true" />}
              Send test ping
            </Button>
          </>
        }
      >
        <div>
          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              <span>Loading delivery logs...</span>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="text-center py-16 px-4 border border-dashed border-subtle rounded-lg bg-page">
              <History className="w-8 h-8 text-muted mx-auto mb-2" />
              <h3 className="text-sm font-bold text-ink">No deliveries recorded</h3>
              <p className="text-xs text-muted max-w-sm mx-auto mt-1">
                This webhook hasn&apos;t received any events yet. Send a test ping to check the address.
              </p>

            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map((delivery) => {
                const isExpanded = expandedDeliveryId === delivery.id;
                return (
                  <div
                    key={delivery.id}
                    className="border border-subtle rounded-md overflow-hidden bg-surface shadow-2xs text-xs"
                  >
                    {/* Delivery Row Header */}
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpand(delivery.id)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-page/80 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                        )}

                        {delivery.success ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-success-soft text-success border border-success/30">
                            <CheckCircle2 className="w-3 h-3 text-success" />
                            {delivery.status} OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-danger-soft text-danger border border-danger/30">
                            <AlertCircle className="w-3 h-3 text-danger" />
                            {delivery.status ? `${delivery.status} Error` : "Failed"}
                          </span>
                        )}

                        <span className="font-mono text-xs font-semibold text-ink bg-surface-sunk px-2 py-0.5 rounded border border-subtle">
                          {delivery.event}
                        </span>

                        <span className="text-muted text-[11px] hidden sm:inline">
                          Duration: <strong className="text-ink">{delivery.durationMs}ms</strong>
                        </span>
                      </div>

                      <div className="text-[11px] text-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true })}</span>
                      </div>
                    </button>

                    {/* Expanded Payload & Response */}
                    {isExpanded && (
                      <div className="p-4 bg-page/70 border-t border-subtle space-y-3">
                        {delivery.error && (
                          <div className="p-2.5 bg-danger-soft border border-danger/30 rounded text-xs text-danger font-medium">
                            <span className="font-bold">Error: </span>
                            {delivery.error}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Request Payload */}
                          <div>
                            <div className="flex items-center justify-between mb-1 text-[11px] font-bold text-ink-2 uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <Code2 className="w-3 h-3 text-accent" />
                                Request Payload (JSON)
                              </span>
                            </div>
                            <pre className="bg-ink text-surface/80 p-3 rounded-md text-[11px] font-mono overflow-x-auto max-h-64 select-all">
                              {formatPayload(delivery.requestPayload)}
                            </pre>
                          </div>

                          {/* Response Body */}
                          <div>
                            <div className="flex items-center justify-between mb-1 text-[11px] font-bold text-ink-2 uppercase tracking-wider">
                              <span>Response Body</span>
                              <span className="font-normal font-mono text-muted">
                                HTTP {delivery.status}
                              </span>
                            </div>
                            <pre className="bg-surface-sunk text-ink p-3 rounded-md text-[11px] font-mono overflow-x-auto max-h-64 border border-subtle">
                              {delivery.responseBody
                                ? formatPayload(delivery.responseBody)
                                : "<No response body returned>"}
                            </pre>
                          </div>
                        </div>

                        <div className="text-[10px] text-muted text-right">
                          Timestamp: {format(new Date(delivery.createdAt), "yyyy-MM-dd HH:mm:ss.SSS")}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
