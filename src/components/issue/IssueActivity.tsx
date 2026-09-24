"use client";

import React, { useMemo, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { History, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import UserAvatar from "@/components/common/UserAvatar";
import MentionInput from "@/components/common/MentionInput";
import MarkdownContent from "@/components/common/MarkdownContent";
import { Button } from "@/components/ui/Button";
import { activityPage, describeActivity, type ActivityEntry, type ActivityFilter } from "@/lib/issueActivity";
import { historyTotal } from "@/lib/issueHistory";
import type { IssueData } from "./useIssueData";
import { Tooltip } from "@/components/ui/Popover";

const FILTERS: { value: ActivityFilter; label: string; icon?: React.ReactNode }[] = [
  { value: "all", label: "All" },
  { value: "comments", label: "Comments", icon: <MessageSquare aria-hidden="true" /> },
  { value: "history", label: "History", icon: <History aria-hidden="true" /> },
];

function When({ at }: { at: string | Date }) {
  const date = new Date(at);
  return (
    <Tooltip content={format(date, "MMM d, yyyy, h:mm a")}>
      <time dateTime={date.toISOString()} className="shrink-0 text-xs text-ink-2">
        {formatDistanceToNow(date, { addSuffix: true })}
      </time>
    </Tooltip>
  );
}

/**
 * Comments and the change history in one list, newest first. The tabs narrow
 * it to either; each list still loads 50 older entries at a time.
 */
export default function IssueActivity({ data }: { data: IssueData }) {
  const { currentUser } = useCurrentUser();
  const { issue, permissions, users, actions, loadingOlder } = data;
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const page = useMemo(() => activityPage(issue, filter), [issue, filter]);
  const userName = (id: string) => users.find((u) => u.id === id)?.name;
  const commentCount = historyTotal(issue, "comments");

  const post = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || posting) return;
    const text = draft;
    setDraft("");
    setPosting(true);
    const ok = await actions.addComment(text);
    setPosting(false);
    if (!ok) setDraft(text);
  };

  const renderEntry = (entry: ActivityEntry) => {
    if (entry.kind === "comment") {
      const comment = entry.comment;
      const canRemove = permissions.canModerate || comment.authorId === currentUser?.id;
      return (
        <li key={`c-${entry.id}`} className="group flex gap-3 py-2">
          <UserAvatar user={comment.author} size="md" />
          <div className="min-w-0 flex-1 rounded-card border border-subtle bg-surface px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-medium text-ink">{comment.author?.name ?? "Someone"}</span>
              <When at={comment.createdAt} />
              {canRemove && !String(comment.id).startsWith("temp-") && (
                <button
                  type="button"
                  onClick={() => actions.removeComment(comment.id)}
                  aria-label="Delete comment"
                  className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-control text-muted opacity-0 transition-opacity hover:bg-surface-sunk hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <MarkdownContent text={comment.content} users={users} className="mt-1 text-[13px] leading-normal text-ink" />
          </div>
        </li>
      );
    }
    const log = entry.log;
    const { verb, from, to } = describeActivity(log, userName);
    return (
      <li key={`h-${entry.id}`} className="flex items-start gap-3 py-1.5 pl-1.5 text-[13px] text-ink-2">
        <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-strong" />
        <p className="min-w-0 flex-1">
          <span className="font-medium text-ink">{log.user?.name ?? "Someone"}</span> {verb}
          {from ? (
            <>
              {" "}
              from <span className="text-ink">{from}</span>
            </>
          ) : null}
          {to ? (
            <>
              {" "}
              {from !== undefined && from !== null ? "to " : ""}
              <span className="text-ink">{to}</span>
            </>
          ) : null}
        </p>
        <When at={log.createdAt} />
      </li>
    );
  };

  const empty = filter === "comments" ? "No comments yet." : filter === "history" ? "No changes recorded yet." : "Nothing here yet.";

  return (
    <section aria-labelledby={`${issue.id}-activity`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${issue.id}-activity`} className="text-[13px] font-semibold text-ink">
          Activity
        </h3>
        {/* One list, narrowed: toggle buttons rather than tabs, which would need a panel each. */}
        <div role="group" aria-label="Show" className="flex items-center gap-0.5 rounded-control bg-surface-sunk p-0.5">
          {FILTERS.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className="inline-flex h-6 items-center gap-1.5 rounded-[4px] px-2 text-xs font-medium text-ink-2 transition-colors hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-raised [&_svg]:h-3.5 [&_svg]:w-3.5"
            >
              {icon}
              {label}
              {value === "comments" && commentCount > 0 && <span className="font-mono text-[11px] text-ink-2">{commentCount}</span>}
            </button>
          ))}
        </div>
      </div>

      {filter !== "history" &&
        (permissions.canAddComment && currentUser ? (
          // On a phone the box stays pinned to the bottom until you reach it.
          <form
            onSubmit={post}
            className="flex items-start gap-3 max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-4 max-md:border-t max-md:border-subtle max-md:bg-surface max-md:px-4 max-md:pb-[max(0.5rem,env(safe-area-inset-bottom))] max-md:pt-2"
          >
            <UserAvatar user={currentUser} size="md" />
            <div className="min-w-0 flex-1">
              <MentionInput
                value={draft}
                onChange={setDraft}
                users={users}
                multiline
                rows={2}
                aria-label="Add a comment"
                placeholder="Add a comment… @ to mention, paste images"
                onSubmit={() => post()}
                onImagePaste={actions.pasteImage}
                className="w-full rounded-control border border-subtle bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted hover:border-strong focus:border-accent"
              />
              {draft.trim().length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <Button type="submit" variant="primary" size="sm" loading={posting}>
                    Comment
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDraft("")}>
                    Cancel
                  </Button>
                  <span className="text-xs text-ink-2">Markdown supported</span>
                </div>
              )}
            </div>
          </form>
        ) : (
          <p className="text-xs text-ink-2">{currentUser ? "You can read this issue but not comment on it." : "Sign in to comment."}</p>
        ))}

      {page.entries.length === 0 && page.remaining === 0 ? (
        <p className="py-2 text-[13px] text-ink-2">{empty}</p>
      ) : (
        <ol className="flex flex-col">{page.entries.map(renderEntry)}</ol>
      )}

      {page.remaining > 0 && page.loadKinds.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={!!loadingOlder}
          onClick={() => actions.loadOlder(page.loadKinds)}
        >
          {loadingOlder ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          Show older ({page.remaining} more)
        </Button>
      )}
    </section>
  );
}
