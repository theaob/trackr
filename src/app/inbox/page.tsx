import React from "react";
import { requirePageUser } from "@/lib/auth/page";
import { getProjects } from "@/lib/actions/projects";
import { getInboxNotifications, getUnreadNotificationCount } from "@/lib/actions/notifications";
import ShellPage from "@/components/shell/ShellPage";
import InboxView from "@/components/inbox/InboxView";

export const dynamic = "force-dynamic";

export const metadata = { title: "Inbox · Trackr" };

export default async function InboxPage() {
  const user = await requirePageUser("/inbox");

  const [projects, initial, unread] = await Promise.all([
    getProjects(),
    getInboxNotifications(),
    getUnreadNotificationCount(),
  ]);

  return (
    <ShellPage projects={projects as any}>
      <InboxView initial={initial as any} initialUnread={unread} />
    </ShellPage>
  );
}
