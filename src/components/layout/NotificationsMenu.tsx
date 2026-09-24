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

    const { href: targetLink, issueKey: extractedIssueKey } = notificationTarget(notif);

    if (extractedIssueKey) {
      try {
        window.dispatchEvent(
          new CustomEvent("trackr:open-issue", {
            detail: { issueKey: extractedIssueKey },
          })
        );
      } catch {}
    }

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
        className="p-2 text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-100 rounded-full transition-colors relative"
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs animate-in zoom-in-50">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-jira-gray-300 rounded-lg shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="px-4 py-2 border-b border-jira-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-jira-navy">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[11px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-jira-blue hover:text-jira-blue-hover font-semibold flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-jira-gray-100 bg-jira-gray-50 text-xs">
            <button
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filter === "all"
                  ? "bg-white text-jira-blue font-bold shadow-xs border border-jira-gray-200"
                  : "text-jira-gray-600 hover:text-jira-navy"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filter === "unread"
                  ? "bg-white text-jira-blue font-bold shadow-xs border border-jira-gray-200"
                  : "text-jira-gray-600 hover:text-jira-navy"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-jira-gray-100">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-jira-gray-500">
                Loading notifications...
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-jira-gray-500">
                {filter === "unread"
                  ? "No unread notifications"
                  : "You're all caught up! No notifications."}
              </div>
            ) : (
              displayedNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 flex items-start gap-3 hover:bg-jira-gray-50 cursor-pointer transition-colors group relative ${
                    !notif.read ? "bg-jira-blue-subtle/40" : ""
                  }`}
                >
                  <div className="mt-1 shrink-0">
                    {!notif.read ? (
                      <span className="w-2 h-2 rounded-full bg-jira-blue block mt-1" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-transparent block mt-1" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-jira-navy truncate flex items-center gap-1.5">
                        <span>{notif.title}</span>
                        <ExternalLink className="w-3 h-3 text-jira-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!notif.read && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkOnlyAsRead(notif);
                            }}
                            className="p-1 text-jira-gray-400 hover:text-jira-blue hover:bg-jira-gray-200 rounded opacity-0 group-hover:opacity-100 transition-all"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <span className="text-[10px] text-jira-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-jira-gray-700 mt-1 leading-snug line-clamp-2">
                      {notif.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          {currentUser.useNewLayout && (
            <div className="border-t border-jira-gray-200 px-4 pt-2">
              <Link
                prefetch={false}
                href="/inbox"
                onClick={() => setIsOpen(false)}
                className="block rounded py-1 text-center text-xs font-semibold text-jira-blue hover:text-jira-blue-hover"
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
