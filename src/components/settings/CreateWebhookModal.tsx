"use client";

import React, { useState } from "react";
import { Webhook, WebhookEvent } from "@/types";
import { createWebhook } from "@/lib/actions/webhooks";
import { X, Webhook as WebhookIcon, Check, Loader2, Shield, Radio } from "lucide-react";

interface CreateWebhookModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (webhook: Webhook) => void;
}

const AVAILABLE_EVENTS: {
  category: string;
  items: { event: WebhookEvent; label: string; description: string }[];
}[] = [
  {
    category: "Issues",
    items: [
      {
        event: "issue:created",
        label: "Issue Created",
        description: "Triggered whenever a new issue is created in the project",
      },
      {
        event: "issue:updated",
        label: "Issue Updated",
        description: "Triggered on title, description, status, priority, or assignee change",
      },
      {
        event: "issue:deleted",
        label: "Issue Deleted",
        description: "Triggered when an issue is permanently deleted",
      },
      {
        event: "issue:linked",
        label: "Issue Linked",
        description: "Triggered when a link (blocks, relates to, duplicates) is added between issues",
      },
      {
        event: "issue:unlinked",
        label: "Issue Unlinked",
        description: "Triggered when a link between issues is removed",
      },
    ],
  },
  {
    category: "Comments",
    items: [
      {
        event: "comment:created",
        label: "Comment Added",
        description: "Triggered whenever someone posts a comment on an issue",
      },
    ],
  },
  {
    category: "Sprints",
    items: [
      {
        event: "sprint:started",
        label: "Sprint Started",
        description: "Triggered when an agile sprint is activated",
      },
      {
        event: "sprint:completed",
        label: "Sprint Completed",
        description: "Triggered when a sprint is finished and closed",
      },
    ],
  },
  {
    category: "Releases",
    items: [
      {
        event: "version:released",
        label: "Version Released",
        description: "Triggered when a software version is marked as Released",
      },
    ],
  },
];

const ALL_EVENT_KEYS: WebhookEvent[] = AVAILABLE_EVENTS.flatMap((c) =>
  c.items.map((i) => i.event)
);

export default function CreateWebhookModal({
  projectId,
  isOpen,
  onClose,
  onCreated,
}: CreateWebhookModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([
    "issue:created",
    "issue:updated",
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleEvent = (event: WebhookEvent) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const handleSelectAll = () => {
    setSelectedEvents(ALL_EVENT_KEYS);
  };

  const handleDeselectAll = () => {
    setSelectedEvents([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a webhook name");
      return;
    }

    if (!url.trim() || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      setError("Please provide a valid HTTP or HTTPS endpoint URL");
      return;
    }

    if (selectedEvents.length === 0) {
      setError("Please select at least one event trigger");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createWebhook({
        name: name.trim(),
        url: url.trim(),
        secret: secret.trim() || undefined,
        events: selectedEvents,
        projectId,
      });

      if (res.success && res.webhook) {
        onCreated(res.webhook);
        onClose();
        setName("");
        setUrl("");
        setSecret("");
        setSelectedEvents(["issue:created", "issue:updated"]);
      } else {
        setError(res.error || "Failed to create webhook");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-lg shadow-2xl border border-jira-gray-300 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-jira-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-jira-blue-light/70 flex items-center justify-center text-jira-blue">
              <WebhookIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-jira-navy">Create Webhook Trigger</h2>
              <p className="text-xs text-jira-gray-500">
                Send real-time HTTP POST notifications when events happen in this project.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-jira-gray-400 hover:text-jira-navy p-1 rounded hover:bg-jira-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-jira-red/10 border border-jira-red/30 rounded text-xs text-jira-red font-medium">
              {error}
            </div>
          )}

          {/* Webhook Name */}
          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1">
              Webhook Name <span className="text-jira-red">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Slack Engineering Alerts, Zapier Issue Sync, CI Pipeline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
              autoFocus
              required
            />
          </div>

          {/* Target URL */}
          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1">
              Payload Endpoint URL <span className="text-jira-red">*</span>
            </label>
            <input
              type="url"
              placeholder="https://api.yourcompany.com/webhooks or http://localhost:3000/api/mock-webhook-receiver"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none font-mono text-[11px]"
              required
            />
            <p className="text-[11px] text-jira-gray-500 mt-1">
              The external URL where HTTP POST requests with JSON payloads will be delivered.
            </p>
          </div>

          {/* Secret Key (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-jira-gray-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-jira-blue" />
                Secret Key (Optional HMAC Signature)
              </span>
              <span className="text-[10px] text-jira-gray-400 font-normal">Optional</span>
            </label>
            <input
              type="text"
              placeholder="e.g. whsec_9a8b7c6d5e4f3a2b1c0d"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none font-mono text-[11px]"
            />
            <p className="text-[11px] text-jira-gray-500 mt-1">
              If provided, payloads will be signed using HMAC SHA-256 and sent in the <code className="text-jira-navy font-semibold">X-Hub-Signature-256</code> header.
            </p>
          </div>

          {/* Event Triggers */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider">
                Event Triggers ({selectedEvents.length} selected)
              </label>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-jira-blue hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-jira-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-jira-gray-500 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="space-y-3 bg-jira-gray-50/70 border border-jira-gray-300 rounded-md p-3">
              {AVAILABLE_EVENTS.map((category) => (
                <div key={category.category} className="space-y-1.5">
                  <div className="text-[11px] font-bold text-jira-gray-600 uppercase tracking-wider pb-1 border-b border-jira-gray-200">
                    {category.category}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    {category.items.map((item) => {
                      const isChecked = selectedEvents.includes(item.event);
                      return (
                        <label
                          key={item.event}
                          className={`flex items-start gap-2 p-2 rounded cursor-pointer border transition-colors ${
                            isChecked
                              ? "bg-white border-jira-blue/60 shadow-2xs"
                              : "bg-white/60 border-transparent hover:bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleEvent(item.event)}
                            className="mt-0.5 w-3.5 h-3.5 rounded text-jira-blue focus:ring-jira-blue border-jira-gray-300"
                          />
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-jira-navy">
                              {item.label}
                            </div>
                            <p className="text-[10px] text-jira-gray-500 leading-tight">
                              {item.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-jira-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium px-4 py-2 rounded text-jira-gray-700 hover:bg-jira-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-xs font-semibold px-4 py-2 rounded bg-jira-blue text-white hover:bg-jira-blue-hover disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Webhook
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
