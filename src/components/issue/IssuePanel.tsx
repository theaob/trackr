"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Issue } from "@/types";
import { getIssueByKeyOrId } from "@/lib/actions/issues";
import { Sheet, SheetContent } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import IssueView from "./IssueView";
import type { IssueContext } from "./useIssueData";
import { useIssueStepper } from "./useIssueStepper";

export interface IssuePanelProps extends IssueContext {
  /** The issue to show; null closes the panel. */
  issue: Issue | null;
  /** The list it was opened from, for "3 of 6" and the arrow keys. */
  issues?: Issue[];
  onClose: () => void;
  onIssueUpdated?: (issue: Issue) => void;
  onIssueDeleted?: (issueId: string) => void;
}

/**
 * The issue view in a panel over the board, backlog, roadmap or issue table.
 * Parents, children and linked issues open in the same panel, with a way
 * back; the expand button opens the issue's own page.
 */
export default function IssuePanel({ issue, issues = [], onClose, onIssueUpdated, onIssueDeleted, ...context }: IssuePanelProps) {
  const { toast } = useToast();
  const [shown, setShown] = useState<Issue | null>(issue);
  const [trail, setTrail] = useState<Issue[]>([]);

  // A new issue from the host starts a fresh trail.
  const hostId = issue?.id;
  const hostIssue = useRef(issue);
  hostIssue.current = issue;
  useEffect(() => {
    setShown(hostIssue.current);
    setTrail([]);
  }, [hostId]);
  // The host's copy changed (moved on the board): show the change.
  useEffect(() => {
    if (issue) setShown((prev) => (prev && prev.id === issue.id ? { ...prev, ...issue } : prev));
  }, [issue]);

  const shownRef = useRef(shown);
  shownRef.current = shown;
  const requestRef = useRef(0);
  const openIssue = useCallback(
    async (keyOrId: string, remember: boolean) => {
      const request = ++requestRef.current;
      const known = issues.find((i) => i.id === keyOrId || i.key.toUpperCase() === keyOrId.toUpperCase());
      const target = known ?? ((await getIssueByKeyOrId(keyOrId)) as unknown as Issue | null);
      if (request !== requestRef.current) return;
      if (!target) {
        toast({ title: `Couldn't open ${keyOrId}`, description: "It may have been deleted, or you can't see it.", tone: "danger" });
        return;
      }
      const from = shownRef.current;
      if (remember && from) setTrail((t) => [...t, from]);
      setShown(target);
    },
    [issues, toast]
  );

  const nav = useIssueStepper(shown, issues, (next) => {
    setTrail([]);
    setShown(next);
  });

  const back = trail.length
    ? () => {
        setShown(trail[trail.length - 1]);
        setTrail((t) => t.slice(0, -1));
      }
    : undefined;

  const handleUpdated = useCallback(
    (updated: Issue) => {
      setShown((prev) => (prev && prev.id === updated.id ? updated : prev));
      onIssueUpdated?.(updated);
    },
    [onIssueUpdated]
  );

  const title = useMemo(() => (shown ? `${shown.key}: ${shown.title}` : "Issue"), [shown]);

  return (
    <Sheet open={!!issue && !!shown} onOpenChange={(open) => !open && onClose()}>
      {shown && (
        <SheetContent
          side="right"
          title={title}
          showTitle={false}
          showClose={false}
          bodyClassName="p-0"
          className="max-w-[min(920px,100vw)] focus-visible:outline-none"
          // Focus the panel, not its first button: the keys work straight away
          // and no focus ring lands on "Watch".
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
        >
          <IssueView
            issue={shown}
            variant="panel"
            {...context}
            onIssueUpdated={handleUpdated}
            onIssueDeleted={onIssueDeleted}
            onClose={onClose}
            onOpenIssue={(keyOrId) => openIssue(keyOrId, true)}
            onBack={back}
            nav={nav}
          />
        </SheetContent>
      )}
    </Sheet>
  );
}
