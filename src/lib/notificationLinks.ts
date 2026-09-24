/**
 * Where a notification leads. Older notifications carry no link, or a link
 * without the issue; the issue key in the title or message fills the gap so
 * clicking one always opens the issue it's about.
 */
export function notificationTarget(notification: {
  title: string;
  message: string;
  link?: string | null;
}): { href: string | null; issueKey: string | null } {
  const match =
    notification.title.match(/\b([A-Z][A-Z0-9]*-\d+)\b/) || notification.message.match(/\b([A-Z][A-Z0-9]*-\d+)\b/);
  const issueKey = match ? match[1] : null;

  // Only same-site paths: a notification never sends anyone off the site.
  const link = notification.link && notification.link.startsWith("/") && !notification.link.startsWith("//") ? notification.link : null;

  if (link) {
    if (issueKey && !link.includes("selectedIssue=")) {
      return { href: `${link}${link.includes("?") ? "&" : "?"}selectedIssue=${issueKey}`, issueKey };
    }
    return { href: link, issueKey };
  }
  if (issueKey) {
    return { href: `/projects/${issueKey.replace(/-\d+$/, "")}/board?selectedIssue=${issueKey}`, issueKey };
  }
  return { href: null, issueKey: null };
}

/** "Today", "Yesterday", or the date, for grouping the Inbox by day. */
export function inboxDayLabel(createdAt: string | Date, now: Date = new Date()): string {
  const day = new Date(createdAt);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(day)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return day.toLocaleDateString(undefined, {
    weekday: diffDays < 7 ? "long" : undefined,
    month: "long",
    day: "numeric",
    year: day.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
