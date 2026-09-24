"use client";

import React, { useState } from "react";
import { Webhook, WebhookEvent } from "@/types";
import { createWebhook, validateWebhookJql } from "@/lib/actions/webhooks";
import { X, Webhook as WebhookIcon, Check, Loader2, Shield, Filter } from "lucide-react";

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
        description: "Triggered on title, description, story points, or general field edits",
      },
      {
        event: "issue:transitioned",
        label: "Status Transitioned",
        description: "Triggered when an issue moves between workflow columns",
      },
      {
        event: "issue:assigned",
        label: "Assignee Changed",
        description: "Triggered when an issue is assigned or reassigned to a member",
      },
      {
        event: "issue:priority_changed",
        label: "Priority Changed",
        description: "Triggered when issue priority is adjusted or escalated",
      },
      {
        event: "issue:deleted",
        label: "Issue Deleted",
        description: "Triggered when an issue is permanently deleted",
      },
      {
        event: "issue:linked",
        label: "Issue Linked",
        description: "Triggered when a relationship link (blocks, relates to) is added",
      },
      {
        event: "issue:unlinked",
        label: "Issue Unlinked",
        description: "Triggered when an issue link relationship is removed",
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
      {
        event: "comment:updated",
        label: "Comment Edited",
        description: "Triggered when an existing comment is modified",
      },
      {
        event: "comment:deleted",
        label: "Comment Deleted",
        description: "Triggered when a comment is removed",
      },
    ],
  },
  {
    category: "Attachments",
    items: [
      {
        event: "attachment:created",
        label: "File Attached",
        description: "Triggered when a file or screenshot is uploaded to an issue",
      },
      {
        event: "attachment:deleted",
        label: "Attachment Removed",
        description: "Triggered when an attached file is deleted",
      },
    ],
  },
  {
    category: "Worklogs",
    items: [
      {
        event: "worklog:created",
        label: "Work Logged",
        description: "Triggered when spent time is recorded against an issue",
      },
      {
        event: "worklog:deleted",
        label: "Worklog Removed",
        description: "Triggered when a logged work entry is deleted",
      },
    ],
  },
  {
    category: "Sprints",
    items: [
      {
        event: "sprint:created",
        label: "Sprint Created",
        description: "Triggered when a new agile sprint is planned",
      },
      {
        event: "sprint:started",
        label: "Sprint Started",
        description: "Triggered when an agile sprint is activated",
      },
      {
        event: "sprint:updated",
        label: "Sprint Updated",
        description: "Triggered when sprint name, goal, or dates are modified",
      },
      {
        event: "sprint:completed",
        label: "Sprint Completed",
        description: "Triggered when a sprint is finished and closed",
      },
      {
        event: "sprint:deleted",
        label: "Sprint Deleted",
        description: "Triggered when a sprint is permanently deleted",
      },
    ],
  },
  {
    category: "Releases & Versions",
    items: [
      {
        event: "version:created",
        label: "Release Created",
        description: "Triggered when a software version is planned",
      },
      {
        event: "version:updated",
        label: "Release Updated",
        description: "Triggered when version details or dates are modified",
      },
      {
        event: "version:released",
        label: "Release Published",
        description: "Triggered when a software version is marked as Released",
      },
      {
        event: "version:archived",
        label: "Release Archived",
        description: "Triggered when a version is archived or unarchived",
      },
      {
        event: "version:deleted",
        label: "Release Deleted",
        description: "Triggered when a software version is deleted",
      },
    ],
  },
];

const ALL_EVENT_KEYS: WebhookEvent[] = AVAILABLE_EVENTS.flatMap((c) =>
  c.items.map((i) => i.event)
);

const ISSUE_EVENTS: WebhookEvent[] = [
  "issue:created",
  "issue:updated",
  "issue:transitioned",
  "issue:assigned",
  "issue:priority_changed",
  "issue:deleted",
  "issue:linked",
  "issue:unlinked",
];

const TRANSITION_EVENTS: WebhookEvent[] = [
  "issue:transitioned",
  "issue:assigned",
  "issue:priority_changed",
];

const AGILE_EVENTS: WebhookEvent[] = [
  "sprint:created",
  "sprint:started",
  "sprint:updated",
  "sprint:completed",
  "sprint:deleted",
  "version:created",
  "version:updated",
  "version:released",
  "version:archived",
  "version:deleted",
];

export default function CreateWebhookModal({
  projectId,
  isOpen,
  onClose,
  onCreated,
}: CreateWebhookModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [jqlFilter, setJqlFilter] = useState("");
  const [jqlError, setJqlError] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([
    "issue:created",
    "issue:transitioned",
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleEvent = (event: WebhookEvent) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const handleValidateJql = async () => {
    if (!jqlFilter.trim()) {
      setJqlError(null);
      return true;
    }
    const res = await validateWebhookJql(jqlFilter.trim());
    if (!res.valid) {
      setJqlError(res.error || "Invalid TQL syntax");
      return false;
    }
    setJqlError(null);
    return true;
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

    if (jqlFilter.trim()) {
      const isValidJql = await handleValidateJql();
      if (!isValidJql) {
        setError("Please fix the TQL filter first");
        return;
      }
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
        jqlFilter: jqlFilter.trim() || undefined,
      });

      if (res.success && res.webhook) {
        onCreated(res.webhook);
        onClose();
        setName("");
        setUrl("");
        setSecret("");
        setJqlFilter("");
        setSelectedEvents(["issue:created", "issue:transitioned"]);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-none sm:rounded-lg shadow-2xl border-0 sm:border border-subtle w-full h-full sm:h-auto max-w-2xl overflow-hidden flex flex-col max-h-none sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-accent-soft/70 flex items-center justify-center text-accent">
              <WebhookIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">Create Webhook Trigger</h2>
              <p className="text-xs text-muted">
                Send real-time HTTP POST notifications with actor and changelog data.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink p-1 rounded hover:bg-surface-sunk transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded text-xs text-danger font-medium">
              {error}
            </div>
          )}

          {/* Webhook Name */}
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1">
              Webhook Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Slack Engineering Alerts, Zapier Issue Sync, CI Pipeline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-subtle rounded focus:border-accent"
              autoFocus
              required
            />
          </div>

          {/* Target URL */}
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1">
              Payload Endpoint URL <span className="text-danger">*</span>
            </label>
            <input
              type="url"
              placeholder="https://api.yourcompany.com/webhooks or http://localhost:3000/api/mock-webhook-receiver"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-subtle rounded focus:border-accent font-mono text-[11px]"
              required
            />
            <p className="text-[11px] text-muted mt-1">
              The external URL where HTTP POST requests with JSON payloads will be delivered.
            </p>
          </div>

          {/* Secret Key (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-accent" />
                Secret Key (Optional HMAC Signature)
              </span>
              <span className="text-[10px] text-muted font-normal">Optional</span>
            </label>
            <input
              type="text"
              placeholder="e.g. whsec_9a8b7c6d5e4f3a2b1c0d"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-subtle rounded focus:border-accent font-mono text-[11px]"
            />
            <p className="text-[11px] text-muted mt-1">
              If provided, payloads will be signed using HMAC SHA-256 and sent in the <code className="text-ink font-semibold">X-Hub-Signature-256</code> header.
            </p>
          </div>

          {/* TQL issue filter (optional) */}
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-accent" />
                TQL issue filter (optional)
              </span>
              <span className="text-[10px] text-muted font-normal">Optional</span>
            </label>
            <input
              type="text"
              placeholder='e.g. priority in (HIGH, HIGHEST) AND type = BUG'
              value={jqlFilter}
              onChange={(e) => {
                setJqlFilter(e.target.value);
                if (jqlError) setJqlError(null);
              }}
              onBlur={handleValidateJql}
              className={`w-full text-xs px-3 py-2 bg-white border rounded font-mono text-[11px] ${
                jqlError ? "border-danger focus:border-danger" : "border-subtle focus:border-accent"
              }`}
            />
            {jqlError ? (
              <p className="text-[11px] text-danger mt-1 flex items-center gap-1">
                <span>⚠</span> {jqlError}
              </p>
            ) : (
              <p className="text-[11px] text-muted mt-1">
                Only deliver issue-related events if the affected issue matches this TQL query.
              </p>
            )}
          </div>

          {/* Event Triggers */}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-bold text-ink-2 uppercase tracking-wider">
                Event Triggers ({selectedEvents.length} selected)
              </label>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedEvents(ALL_EVENT_KEYS)}
                  className="text-accent hover:underline font-semibold"
                >
                  All Events
                </button>
                <span className="text-muted">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedEvents(ISSUE_EVENTS)}
                  className="text-accent hover:underline"
                >
                  Issues
                </button>
                <span className="text-muted">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedEvents(TRANSITION_EVENTS)}
                  className="text-accent hover:underline"
                >
                  Transitions
                </button>
                <span className="text-muted">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedEvents(AGILE_EVENTS)}
                  className="text-accent hover:underline"
                >
                  Sprints/Releases
                </button>
                <span className="text-muted">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedEvents([])}
                  className="text-muted hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-3 bg-page/70 border border-subtle rounded-md p-3 max-h-72 overflow-y-auto">
              {AVAILABLE_EVENTS.map((category) => (
                <div key={category.category} className="space-y-1.5">
                  <div className="text-[11px] font-bold text-ink-2 uppercase tracking-wider pb-1 border-b border-subtle">
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
                              ? "bg-white border-accent/60 shadow-2xs"
                              : "bg-white/60 border-transparent hover:bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleEvent(item.event)}
                            className="mt-0.5 w-3.5 h-3.5 rounded text-accent focus:ring-accent border-subtle"
                          />
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-ink">
                              {item.label}
                            </div>
                            <p className="text-[10px] text-muted leading-tight">
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
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium px-4 py-2 rounded text-ink-2 hover:bg-surface-sunk transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-xs font-semibold px-4 py-2 rounded bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-2xs"
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
