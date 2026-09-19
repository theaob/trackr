"use client";

import React, { useState, useEffect } from "react";
import { Webhook, WebhookDelivery } from "@/types";
import { getWebhookDeliveries, testWebhook } from "@/lib/actions/webhooks";
import {
  X,
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

  useEffect(() => {
    if (!isOpen || !webhook) return;
    loadDeliveries();
  }, [isOpen, webhook]);

  const loadDeliveries = async () => {
    if (!webhook) return;
    setIsLoading(true);
    try {
      const data = await getWebhookDeliveries(webhook.id);
      setDeliveries(data);
      if (data.length > 0) {
        setExpandedDeliveryId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-none sm:rounded-lg shadow-2xl border-0 sm:border border-jira-gray-300 w-full h-full sm:h-auto max-w-4xl overflow-hidden flex flex-col max-h-none sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-jira-gray-200 shrink-0 bg-white gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded bg-jira-blue-light/70 flex items-center justify-center text-jira-blue shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-base font-bold text-jira-navy truncate">{webhook.name}</h2>
                <span className="text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded bg-jira-gray-100 text-jira-gray-600 border border-jira-gray-300 truncate max-w-[160px] sm:max-w-none">
                  {webhook.url}
                </span>
              </div>
              <p className="text-xs text-jira-gray-500 truncate">
                Recent delivery audit logs and response codes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleTestPing}
              disabled={isTesting}
              className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs"
            >
              {isTesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{isTesting ? "Sending Ping..." : "Send Test Ping"}</span>
              <span className="sm:hidden">{isTesting ? "Sending..." : "Test"}</span>
            </button>
            <button
              onClick={onClose}
              className="text-jira-gray-400 hover:text-jira-navy p-1 rounded hover:bg-jira-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-jira-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-jira-blue" />
              <span>Loading delivery logs...</span>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="text-center py-16 px-4 border border-dashed border-jira-gray-300 rounded-lg bg-jira-gray-50">
              <History className="w-8 h-8 text-jira-gray-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-jira-navy">No deliveries recorded</h3>
              <p className="text-xs text-jira-gray-500 max-w-sm mx-auto mt-1 mb-4">
                This webhook hasn&apos;t received any events yet. You can trigger a test ping to verify the target URL right now.
              </p>
              <button
                onClick={handleTestPing}
                disabled={isTesting}
                className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-3.5 py-1.5 rounded inline-flex items-center gap-1.5 shadow-2xs"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Test Ping
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map((delivery) => {
                const isExpanded = expandedDeliveryId === delivery.id;
                return (
                  <div
                    key={delivery.id}
                    className="border border-jira-gray-200 rounded-md overflow-hidden bg-white shadow-2xs text-xs"
                  >
                    {/* Delivery Row Header */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(delivery.id)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-jira-gray-50/80 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-jira-gray-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-jira-gray-400 shrink-0" />
                        )}

                        {delivery.success ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {delivery.status} OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            {delivery.status ? `${delivery.status} Error` : "Failed"}
                          </span>
                        )}

                        <span className="font-mono text-xs font-semibold text-jira-navy bg-jira-gray-100 px-2 py-0.5 rounded border border-jira-gray-300">
                          {delivery.event}
                        </span>

                        <span className="text-jira-gray-500 text-[11px] hidden sm:inline">
                          Duration: <strong className="text-jira-navy">{delivery.durationMs}ms</strong>
                        </span>
                      </div>

                      <div className="text-[11px] text-jira-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true })}</span>
                      </div>
                    </button>

                    {/* Expanded Payload & Response */}
                    {isExpanded && (
                      <div className="p-4 bg-jira-gray-50/70 border-t border-jira-gray-200 space-y-3">
                        {delivery.error && (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-medium">
                            <span className="font-bold">Error: </span>
                            {delivery.error}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Request Payload */}
                          <div>
                            <div className="flex items-center justify-between mb-1 text-[11px] font-bold text-jira-gray-700 uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <Code2 className="w-3 h-3 text-jira-blue" />
                                Request Payload (JSON)
                              </span>
                            </div>
                            <pre className="bg-jira-navy text-jira-gray-100 p-3 rounded-md text-[11px] font-mono overflow-x-auto max-h-64 select-all">
                              {formatPayload(delivery.requestPayload)}
                            </pre>
                          </div>

                          {/* Response Body */}
                          <div>
                            <div className="flex items-center justify-between mb-1 text-[11px] font-bold text-jira-gray-700 uppercase tracking-wider">
                              <span>Response Body</span>
                              <span className="font-normal font-mono text-jira-gray-500">
                                HTTP {delivery.status}
                              </span>
                            </div>
                            <pre className="bg-jira-gray-100 text-jira-gray-800 p-3 rounded-md text-[11px] font-mono overflow-x-auto max-h-64 border border-jira-gray-300">
                              {delivery.responseBody
                                ? formatPayload(delivery.responseBody)
                                : "<No response body returned>"}
                            </pre>
                          </div>
                        </div>

                        <div className="text-[10px] text-jira-gray-400 text-right">
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
      </div>
    </div>
  );
}
