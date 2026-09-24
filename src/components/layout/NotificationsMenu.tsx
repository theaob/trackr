"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Notification } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/actions/notifications";
import { Bell, Check, CheckCheck, Circle, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { notifyShellCountsChanged } from "@/hooks/useShellCounts";
import { notificationTarget } from "@/lib/notificationLinks";

export default function NotificationsMenu() {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const userId = currentUser?.id;
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const data = await getUserNotifications(userId);
    setNotifications(data as Notification[]);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const displayedNotifications =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read) {
      markNotificationAsRead(notif.id).then(notifyShellCountsChanged);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
    setIsOpen(false);

    // An issue named in the notification opens on its own page.
    const { href: targetLink } = notificationTarget(notif);
    if (targetLink) {
      router.push(targetLink);
    }
  };

  const handleMarkOnlyAsRead = async (notif: Notification) => {
    const previous = notifications;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    const res = await markNotificationAsRead(notif.id);
    if (!res.success) {
      setNotifications(previous);
    }
    notifyShellCountsChanged();
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser) return;
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const res = await markAllNotificationsAsRead(currentUser.id);
    if (!res.success) {
      setNotifications(previous);
    }
    notifyShellCountsChanged();
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="p-2 text-ink-2 hover:text-ink hover:bg-surface-sunk rounded-full transition-colors relative"
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-danger text-accent-fg text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs animate-in zoom-in-50">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-surface border border-subtle rounded-lg shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="px-4 py-2 border-b border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-ink">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[11px] bg-danger-soft text-danger font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-accent hover:text-accent-hover font-semibold flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-subtle bg-page text-xs">
            <button
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filter === "all"
                  ? "bg-surface text-accent font-bold shadow-xs border border-subtle"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filter === "unread"
                  ? "bg-surface text-accent font-bold shadow-xs border border-subtle"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-subtle">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-muted">
                Loading notifications...
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">
                {filter === "unread"
                  ? "No unread notifications"
                  : "You're all caught up! No notifications."}
              </div>
            ) : (
              displayedNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 flex items-start gap-3 hover:bg-page cursor-pointer transition-colors group relative ${
                    !notif.read ? "bg-accent-soft/40" : ""
                  }`}
                >
                  <div className="mt-1 shrink-0">
                    {!notif.read ? (
                      <span className="w-2 h-2 rounded-full bg-accent block mt-1" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-transparent block mt-1" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-ink truncate flex items-center gap-1.5">
                        <span>{notif.title}</span>
                        <ExternalLink className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!notif.read && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkOnlyAsRead(notif);
                            }}
                            className="p-1 text-muted hover:text-accent hover:bg-subtle rounded opacity-0 group-hover:opacity-100 transition-all"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <span className="text-[10px] text-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-ink-2 mt-1 leading-snug line-clamp-2">
                      {notif.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          {currentUser.useNewLayout && (
            <div className="border-t border-subtle px-4 pt-2">
              <Link
                prefetch={false}
                href="/inbox"
                onClick={() => setIsOpen(false)}
                className="block rounded py-1 text-center text-xs font-semibold text-accent hover:text-accent-hover"
              >
                Open Inbox
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
