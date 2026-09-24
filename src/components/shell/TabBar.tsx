"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Inbox, Kanban, ListFilter, LogIn, Menu } from "lucide-react";
import type { Project } from "@/types";
import { shellLocation } from "@/lib/shell";
import { cn } from "@/components/ui/cn";

type Tab = "home" | "board" | "issues" | "inbox";

/** Which tab a page belongs to, if any. */
export function activeTab(pathname: string | null | undefined): Tab | null {
  const location = shellLocation(pathname);
  if (location.section === "home") return "home";
  if (location.section === "inbox") return "inbox";
  if (location.section === "project" && location.pageId === "board") return "board";
  if (location.section === "project" && location.pageId === "issues") return "issues";
  return null;
}

const item =
  "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-ink-2 [&_svg]:h-5 [&_svg]:w-5";

/**
 * On a phone the rail becomes this bar along the bottom: Home, the board and
 * issues of the project you're in (or your first), Inbox, and More for
 * everything else. It sits above the phone's home indicator.
 */
export default function TabBar({
  project,
  unread,
  signedIn = true,
  onMore,
}: {
  project?: Project | null;
  unread: number;
  /** Signed-out visitors get Sign in in place of Home and Inbox. */
  signedIn?: boolean;
  onMore: () => void;
}) {
  const pathname = usePathname();
  const tab = activeTab(pathname);
  const link = (id: Tab, href: string, label: string, icon: React.ReactNode, badge?: number) => (
    <Link prefetch={false} href={href} aria-current={tab === id ? "page" : undefined} className={cn(item, tab === id && "text-accent")}>
      <span className="relative">
        {icon}
        {badge ? (
          <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 text-accent-fg">
            {badge > 99 ? "99+" : badge}
            <span className="sr-only"> unread</span>
          </span>
        ) : null}
      </span>
      {label}
    </Link>
  );

  return (
    <nav
      aria-label="Main"
      className="flex shrink-0 items-stretch border-t border-subtle bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {signedIn && link("home", "/home", "Home", <Home aria-hidden="true" />)}
      {link("board", project ? `/projects/${project.key}/board` : "/projects", "Board", <Kanban aria-hidden="true" />)}
      {link("issues", project ? `/projects/${project.key}/issues` : "/projects", "Issues", <ListFilter aria-hidden="true" />)}
      {signedIn ? (
        link("inbox", "/inbox", "Inbox", <Inbox aria-hidden="true" />, unread)
      ) : (
        <Link prefetch={false} href={`/login?next=${encodeURIComponent(pathname || "/")}`} className={item}>
          <LogIn aria-hidden="true" />
          Sign in
        </Link>
      )}
      <button type="button" onClick={onMore} className={item}>
        <Menu aria-hidden="true" />
        More
      </button>
    </nav>
  );
}
