"use client";

import React, { useState } from "react";
import { Webhook, WebhookEvent } from "@/types";
import { createWebhook, validateWebhookJql } from "@/lib/actions/webhooks";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field, Input } from "@/components/ui/Field";

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
        label: "Issue created",
        description: "Triggered whenever a new issue is created in the project",
      },
      {
        event: "issue:updated",
        label: "Issue updated",
        description: "Triggered on title, description, story points, or general field edits",
      },
      {
        event: "issue:transitioned",
        label: "Status transitioned",
        description: "Triggered when an issue moves between workflow columns",
      },
      {
        event: "issue:assigned",
        label: "Assignee changed",
        description: "Triggered when an issue is assigned or reassigned to a member",
      },
      {
        event: "issue:priority_changed",
        label: "Priority changed",
        description: "Triggered when issue priority is adjusted or escalated",
      },
      {
        event: "issue:deleted",
        label: "Issue deleted",
        description: "Triggered when an issue is permanently deleted",
      },
      {
        event: "issue:linked",
        label: "Issue linked",
        description: "Triggered when a relationship link (blocks, relates to) is added",
      },
      {
        event: "issue:unlinked",
        label: "Issue unlinked",
        description: "Triggered when an issue link relationship is removed",
      },
    ],
  },
  {
    category: "Comments",
    items: [
      {
        event: "comment:created",
        label: "Comment added",
        description: "Triggered whenever someone posts a comment on an issue",
      },
      {
        event: "comment:updated",
        label: "Comment edited",
        description: "Triggered when an existing comment is modified",
      },
      {
        event: "comment:deleted",
        label: "Comment deleted",
        description: "Triggered when a comment is removed",
      },
    ],
  },
  {
    category: "Attachments",
    items: [
      {
        event: "attachment:created",
        label: "File attached",
        description: "Triggered when a file or screenshot is uploaded to an issue",
      },
      {
        event: "attachment:deleted",
        label: "Attachment removed",
        description: "Triggered when an attached file is deleted",
      },
    ],
  },
  {
    category: "Worklogs",
    items: [
      {
        event: "worklog:created",
        label: "Work logged",
        description: "Triggered when spent time is recorded against an issue",
      },
      {
        event: "worklog:deleted",
        label: "Worklog removed",
        description: "Triggered when a logged work entry is deleted",
      },
    ],
  },
  {
    category: "Sprints",
    items: [
      {
        event: "sprint:created",
        label: "Sprint created",
        description: "Triggered when a new agile sprint is planned",
      },
      {
        event: "sprint:started",
        label: "Sprint started",
        description: "Triggered when an agile sprint is activated",
      },
      {
        event: "sprint:updated",
        label: "Sprint updated",
        description: "Triggered when sprint name, goal, or dates are modified",
      },
      {
        event: "sprint:completed",
        label: "Sprint completed",
        description: "Triggered when a sprint is finished and closed",
      },
      {
        event: "sprint:deleted",
        label: "Sprint deleted",
        description: "Triggered when a sprint is permanently deleted",
      },
    ],
  },
  {
    category: "Releases & Versions",
    items: [
      {
        event: "version:created",
        label: "Release created",
        description: "Triggered when a software version is planned",
      },
      {
        event: "version:updated",
        label: "Release updated",
        description: "Triggered when version details or dates are modified",
      },
      {
        event: "version:released",
        label: "Release published",
        description: "Triggered when a software version is marked as Released",
      },
      {
        event: "version:archived",
        label: "Release archived",
        description: "Triggered when a version is archived or unarchived",
      },
      {
        event: "version:deleted",
        label: "Release deleted",
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

  const presets: { label: string; events: WebhookEvent[] }[] = [
    { label: "All", events: ALL_EVENT_KEYS },
    { label: "Issues", events: ISSUE_EVENTS },
    { label: "Transitions", events: TRANSITION_EVENTS },
    { label: "Sprints and releases", events: AGILE_EVENTS },
    { label: "None", events: [] },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="lg"
        title="Create webhook"
        description="Tamam sends an HTTP POST with the event, who did it and what changed."
        footer={
          <>
            <span className="mr-auto text-xs text-muted">
              {selectedEvents.length} event{selectedEvents.length === 1 ? "" : "s"} chosen
            </span>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" form="webhook-form" variant="primary" loading={isSubmitting}>
              Create webhook
            </Button>
          </>
        }
      >
        <form id="webhook-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          <Field label="Name" required>
            <Input placeholder="Slack alerts, CI pipeline" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="URL" required hint="Where the JSON payloads are sent.">
            <Input
              type="url"
              className="font-mono text-xs"
              placeholder="https://example.com/webhooks/tamam"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <Field
            label="Secret"
            hint={
              <>
                If set, each payload is signed with HMAC SHA-256 in the <code className="font-mono text-ink">X-Hub-Signature-256</code> header.
              </>
            }
          >
            <Input className="font-mono text-xs" placeholder="whsec_…" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </Field>
          <Field
            label="Only for issues matching (TQL)"
            error={jqlError}
            hint="Issue events are sent only when the issue matches. Leave empty for all issues."
          >
            <Input
              className="font-mono text-xs"
              placeholder="priority in (HIGH, HIGHEST) AND type = BUG"
              value={jqlFilter}
              onChange={(e) => {
                setJqlFilter(e.target.value);
                if (jqlError) setJqlError(null);
              }}
              onBlur={handleValidateJql}
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-ink-2">Events</legend>
            <div role="group" aria-label="Choose events" className="flex flex-wrap gap-1">
              {presets.map((p) => (
                <Button key={p.label} size="sm" variant="ghost" onClick={() => setSelectedEvents(p.events)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-control border border-subtle p-3">
              {AVAILABLE_EVENTS.map((category) => (
                <fieldset key={category.category} className="space-y-1.5">
                  <legend className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{category.category}</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {category.items.map((item) => (
                      <label key={item.event} className="flex cursor-pointer items-start gap-2 rounded-control p-1.5 hover:bg-surface-sunk">
                        <Checkbox
                          className="mt-0.5"
                          checked={selectedEvents.includes(item.event)}
                          onChange={() => toggleEvent(item.event)}
                          aria-describedby={`event-${item.event}`}
                        />
                        <span className="space-y-0.5">
                          <span className="block text-xs font-medium text-ink">{item.label}</span>
                          <span id={`event-${item.event}`} className="block text-[11px] leading-tight text-muted">
                            {item.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
