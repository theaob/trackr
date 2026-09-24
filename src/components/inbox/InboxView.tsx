"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, Inbox as InboxIcon, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@/types";
import {
  getInboxNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/actions/notifications";
import { inboxDayLabel, notificationTarget } from "@/lib/notificationLinks";
import { notifyShellCountsChanged } from "@/hooks/useShellCounts";
import { Button, IconButton } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

type Filter = "all" | "unread";

export interface InboxViewProps {
  initial: { items: Notification[]; nextCursor: string | null };
  initialUnread: number;
}

/** Every notification, a page at a time; the bell in the top bar stays as a quick preview. */
export default function InboxView({ initial, initialUnread }: InboxViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<Notification[]>(initial.items);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor);
  const [unread, setUnread] = useState(initialUnread);
  const [loading, startLoading] = useTransition();

  const load = (nextFilter: Filter, cursor: string | null) =>
    startLoading(async () => {
      const page = await getInboxNotifications({ cursor, unreadOnly: nextFilter === "unread" });
      setItems((prev) => (cursor ? [...prev, ...(page.items as Notification[])] : (page.items as Notification[])));
      setNextCursor(page.nextCursor);
    });

  const changeFilter = (next: Filter) => {
    if (next === filter) return;
    setFilter(next);
    load(next, null);
  };

  const markRead = async (notification: Notification) => {
    if (notification.read) return;
    setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
    setUnread((n) => Math.max(0, n - 1));
    const res = await markNotificationAsRead(notification.id);
    if (!res.success) {
      setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: false } : n)));
      setUnread((n) => n + 1);
    }
    notifyShellCountsChanged();
  };

  const markAll = async () => {
    const previous = items;
    const previousUnread = unread;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    const res = await markAllNotificationsAsRead();
    if (!res.success) {
      setItems(previous);
      setUnread(previousUnread);
    }
    notifyShellCountsChanged();
  };

  const open = (notification: Notification) => {
    markRead(notification);
    const { href } = notificationTarget(notification);
    if (href) router.push(href);
  };

  // The Unread tab keeps a just-read item until the next load, so it doesn't jump away under the pointer.
  const groups = useMemo(() => {
    const now = new Date();
    const byDay: { label: string; items: Notification[] }[] = [];
    for (const item of items) {
      const label = inboxDayLabel(item.createdAt, now);
      const last = byDay[byDay.length - 1];
      if (last && last.label === label) last.items.push(item);
      else byDay.push({ label, items: [item] });
    }
    return byDay;
  }, [items]);

  return (
    <div className="flex-1 overflow-y-auto bg-page">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Show" className="inline-flex rounded-control border border-subtle bg-surface p-0.5">
            {(["all", "unread"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => changeFilter(value)}
                className={cn(
                  "h-7 rounded-[4px] px-3 text-[13px] font-medium transition-colors",
                  filter === value ? "bg-accent-soft text-ink" : "text-ink-2 hover:text-ink"
                )}
              >
                {value === "all" ? "All" : `Unread${unread > 0 ? ` (${unread})` : ""}`}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <Button size="sm" onClick={markAll} disabled={unread === 0}>
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Mark all as read
          </Button>
        </div>

        {loading && items.length === 0 ? (
          <div className="flex justify-center py-16 text-ink-2" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-strong px-6 py-16 text-center">
            <InboxIcon className="h-6 w-6 text-muted" aria-hidden="true" />
            <p className="text-[13px] font-medium text-ink">{filter === "unread" ? "No unread notifications" : "Your inbox is empty"}</p>
            <p className="text-[13px] text-ink-2">Mentions, assignments and changes to issues you watch arrive here.</p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-2">{group.label}</h2>
              <ul className="overflow-hidden rounded-card border border-subtle bg-surface shadow-raised">
                {group.items.map((notification) => (
                  <li key={notification.id} className="group relative border-b border-subtle last:border-b-0">
                    <button
                      type="button"
                      onClick={() => open(notification)}
                      className={cn(
                        "flex w-full items-start gap-3 py-card-y pl-4 pr-12 text-left transition-colors hover:bg-surface-sunk",
                        !notification.read && "bg-accent-soft/40"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", notification.read ? "bg-transparent" : "bg-accent")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[13px] text-ink", !notification.read && "font-semibold")}>
                          {!notification.read && <span className="sr-only">Unread: </span>}
                          {notification.title}
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-5 text-ink-2">{notification.message}</span>
                        <span className="mt-1 block text-xs text-ink-2">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                      </span>
                    </button>
                    {!notification.read && (
                      <IconButton
                        label="Mark as read"
                        icon={<Check />}
                        size="sm"
                        onClick={() => markRead(notification)}
                        className="absolute right-3 top-3"
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        {nextCursor && (
          <div className="flex justify-center">
            <Button onClick={() => load(filter, nextCursor)} loading={loading}>
              Load older
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
