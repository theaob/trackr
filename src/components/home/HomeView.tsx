"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Clock, Inbox as InboxIcon, LayoutGrid } from "lucide-react";
import type { HomeData, HomeIssue } from "@/lib/actions/home";
import type { IssueType, PriorityLevel } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import { IssueTypeIcon, PriorityIcon } from "@/components/common/IssueIcons";
import { StatusLozenge } from "@/components/ui/StatusLozenge";
import { cn } from "@/components/ui/cn";
import { formatCalendarDate } from "@/lib/calendarDate";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import { spotlightIssueHref } from "@/lib/spotlight";
import { groupDueSoon, isProjectMember, projectInitials, type DueBucket, type RecentIssue } from "@/lib/shell";
import { readRecentIssues, RECENT_ISSUES_EVENT } from "@/lib/recentIssuesStore";

export interface HomeProject {
  id: string;
  key: string;
  name: string;
  openIssues: number;
  activeSprint: string | null;
  leadId?: string | null;
  members?: { userId: string }[];
}

const DUE_LABELS: Record<Exclude<DueBucket, "later">, string> = {
  overdue: "Overdue",
  today: "Due today",
  week: "Next 7 days",
};

function greeting(now: Date) {
  const hour = now.getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function Card({ id, title, icon, action, children }: { id: string; title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-card border border-subtle bg-surface shadow-raised">
      <div className="flex items-center gap-2 border-b border-subtle px-4 py-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-muted">
        {icon}
        <h2 id={id} className="flex-1 text-[13px] font-semibold text-ink">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function IssueRow({ issue, trailing }: { issue: HomeIssue; trailing?: React.ReactNode }) {
  return (
    <li>
      <Link
        prefetch={false}
        href={spotlightIssueHref(issue.projectKey, issue.key)}
        className="flex min-h-list-row items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-sunk"
      >
        <IssueTypeIcon type={issue.type as IssueType} className="h-4 w-4 shrink-0" />
        <span className="w-20 shrink-0 font-mono text-xs text-ink-2">{issue.key}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{issue.title}</span>
        {trailing}
      </Link>
    </li>
  );
}

export default function HomeView({ data, projects }: { data: HomeData; projects: HomeProject[] }) {
  const { currentUser } = useCurrentUser();
  // Rendered on the server without a clock the viewer shares; filled in after.
  const [now, setNow] = useState<Date | null>(null);
  const [recent, setRecent] = useState<RecentIssue[]>([]);

  useEffect(() => setNow(new Date()), []);
  useEffect(() => {
    const load = () => setRecent(readRecentIssues(currentUser?.id));
    load();
    window.addEventListener(RECENT_ISSUES_EVENT, load);
    return () => window.removeEventListener(RECENT_ISSUES_EVENT, load);
  }, [currentUser?.id]);

  const dueGroups = useMemo(() => (now ? groupDueSoon(data.dueSoon, now) : []), [data.dueSoon, now]);
  const myProjects = useMemo(
    () => projects.filter((p) => isProjectMember(currentUser?.id, p)),
    [projects, currentUser?.id]
  );
  const firstName = currentUser?.name.split(/\s+/)[0] ?? "";

  return (
    <div className="flex-1 overflow-y-auto bg-page">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        <div>
          <p className="text-[13px] text-ink-2" suppressHydrationWarning>
            {now ? now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : " "}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
            {now ? `${greeting(now)}, ${firstName}` : `Welcome, ${firstName}`}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card
            id="home-assigned"
            title="Assigned to you"
            icon={<InboxIcon aria-hidden="true" />}
            action={
              data.assignedTotal > 0 ? (
                <span className="font-mono text-xs text-ink-2">
                  {data.assignedTotal > data.assigned.length ? `${data.assigned.length} of ${data.assignedTotal}` : data.assignedTotal}
                </span>
              ) : null
            }
          >
            {data.assigned.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-ink-2">Nothing open is assigned to you. Enjoy the quiet.</p>
            ) : (
              <ul className="divide-y divide-subtle">
                {data.assigned.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    trailing={
                      <>
                        <span className="hidden w-36 shrink-0 truncate text-xs text-ink-2 md:block">{issue.projectName}</span>
                        <StatusLozenge label={prettifyStatusName(issue.status)} color={issue.statusColor} className="hidden sm:inline-flex" />
                        <span className="shrink-0">
                          <PriorityIcon priority={issue.priority as PriorityLevel} className="h-4 w-4" />
                          <span className="sr-only">{`Priority: ${issue.priority.toLowerCase()}`}</span>
                        </span>
                      </>
                    }
                  />
                ))}
              </ul>
            )}
          </Card>

          <div className="flex flex-col gap-6">
            <Card id="home-due" title="Due soon" icon={<CalendarClock aria-hidden="true" />}>
              {dueGroups.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-ink-2">Nothing due this week.</p>
              ) : (
                dueGroups.map((group) => (
                  <div key={group.bucket}>
                    <h3
                      className={cn(
                        "px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide",
                        group.bucket === "overdue" ? "text-danger" : "text-ink-2"
                      )}
                    >
                      {DUE_LABELS[group.bucket]}
                    </h3>
                    <ul>
                      {group.issues.map((issue) => (
                        <IssueRow
                          key={issue.id}
                          issue={issue}
                          trailing={
                            <span className={cn("shrink-0 font-mono text-xs", group.bucket === "overdue" ? "text-danger" : "text-ink-2")}>
                              {formatCalendarDate(issue.dueDate, "MMM d")}
                            </span>
                          }
                        />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </Card>

            <Card id="home-recent" title="Recently viewed" icon={<Clock aria-hidden="true" />}>
              {recent.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-ink-2">Issues you open show up here.</p>
              ) : (
                <ul>
                  {recent.map((item) => (
                    <li key={item.key}>
                      <Link
                        prefetch={false}
                        href={spotlightIssueHref(item.projectKey, item.key)}
                        className="flex min-h-row items-center gap-3 px-4 py-1.5 transition-colors hover:bg-surface-sunk"
                      >
                        <span className="w-20 shrink-0 font-mono text-xs text-ink-2">{item.key}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        <section aria-labelledby="home-projects">
          <div className="mb-3 flex items-center gap-2">
            <h2 id="home-projects" className="flex-1 text-[13px] font-semibold text-ink">
              Your projects
            </h2>
            <Link prefetch={false} href="/projects" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
              All projects <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          {myProjects.length === 0 ? (
            <div className="flex items-center gap-3 rounded-card border border-dashed border-strong px-4 py-6 text-[13px] text-ink-2">
              <LayoutGrid className="h-4 w-4 text-muted" aria-hidden="true" />
              You aren&apos;t on any project yet. Browse all projects, or ask an administrator to add you.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {myProjects.map((project) => (
                <li key={project.id}>
                  <Link
                    prefetch={false}
                    href={`/projects/${project.key}/board`}
                    className="flex items-center gap-3 rounded-card border border-subtle bg-surface p-3 shadow-raised transition-colors hover:border-strong"
                  >
                    <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-soft font-mono text-xs font-semibold text-accent">
                      {projectInitials(project.key)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{project.name}</span>
                      <span className="block truncate text-xs text-ink-2">
                        {project.activeSprint ?? project.key} · {project.openIssues} open
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
