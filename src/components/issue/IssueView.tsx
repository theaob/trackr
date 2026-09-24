"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, EyeOff, Link2, Maximize2, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import type { Issue } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import { IssueTypeIcon } from "@/components/common/IssueIcons";
import IssueDescriptionEditor from "@/components/issues/IssueDescriptionEditor";
import ChildIssuesSection from "@/components/issues/ChildIssuesSection";
import IssueLinksSection from "@/components/issues/IssueLinksSection";
import AttachmentsSection from "@/components/issues/AttachmentsSection";
import { Button, IconButton } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { issueHref } from "@/lib/issueUrls";
import { issueShortcutFor } from "@/lib/issueActivity";
import IssueProperties, { type PickerName } from "./IssueProperties";
import PropertyChips from "./PropertyChips";
import IssueActivity from "./IssueActivity";
import { useIssueData, type IssueContext } from "./useIssueData";

export type IssueViewVariant = "panel" | "split" | "page";

export interface IssueNavigation {
  /** Zero-based position in the list the issue was opened from. */
  index: number;
  total: number;
  prevKey?: string;
  nextKey?: string;
  onPrev?: () => void;
  onNext?: () => void;
}

export interface IssueViewProps extends IssueContext {
  issue: Issue;
  /** Where it's shown: beside a board, in the Issues split view, or on its own page. */
  variant: IssueViewVariant;
  onIssueUpdated?: (issue: Issue) => void;
  onIssueDeleted?: (issueId: string) => void;
  /** Shown as a close button (the side panel). */
  onClose?: () => void;
  /** Opens another issue (a parent, child or linked one) in place; without it, on its own page. */
  onOpenIssue?: (keyOrId: string) => void;
  /** "3 of 6" and the arrows, for an issue opened from a list. */
  nav?: IssueNavigation;
  /** Back to the issue this one was opened from. */
  onBack?: () => void;
  /** Single-key shortcuts and pasting images anywhere. On unless something else owns the keyboard. */
  shortcuts?: boolean;
}

const GRID: Record<IssueViewVariant, { grid: string; aside: string }> = {
  page: {
    grid: "lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8",
    aside: "lg:order-none lg:col-start-2 lg:row-start-1 lg:sticky lg:top-4 lg:self-start lg:border-0 lg:pb-0",
  },
  panel: {
    grid: "md:grid-cols-[minmax(0,1fr)_264px] md:gap-6",
    aside: "md:order-none md:col-start-2 md:row-start-1 md:sticky md:top-0 md:self-start md:border-0 md:pb-0",
  },
  split: {
    grid: "xl:grid-cols-[minmax(0,1fr)_264px] xl:gap-6",
    aside: "xl:order-none xl:col-start-2 xl:row-start-1 xl:sticky xl:top-0 xl:self-start xl:border-0 xl:pb-0",
  },
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable ||
    !!target.closest("[contenteditable='true'], .ProseMirror")
  );
}

/** Inside an open list, menu or dialog of its own, where letters mean something else. */
function inOtherWidget(target: EventTarget | null, root: HTMLElement | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[role='listbox'], [role='menu'], [data-radix-popper-content-wrapper]")) return true;
  const dialog = target.closest("[role='dialog'], [role='alertdialog']");
  return !!dialog && !!root && !dialog.contains(root);
}

/**
 * One issue: its title and description, sub-issues, links, attachments and
 * activity, with its properties alongside. The same view appears in the side
 * panel over the board, in the Issues split view and on the issue's own page.
 */
export default function IssueView({
  issue: initialIssue,
  variant,
  project,
  users,
  sprints,
  versions,
  epics,
  onIssueUpdated,
  onIssueDeleted,
  onClose,
  onOpenIssue,
  nav,
  onBack,
  shortcuts = true,
}: IssueViewProps) {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const { toast, dismiss: dismissToast } = useToast();
  const data = useIssueData({ issue: initialIssue, project, users, sprints, versions, epics, onIssueUpdated, onIssueDeleted });
  const { issue, permissions, actions, sections, projectKey } = data;
  const canEdit = permissions.canEditIssue;
  const href = issueHref(projectKey, issue.key);
  const rootRef = useRef<HTMLDivElement>(null);

  const [openPicker, setOpenPicker] = useState<PickerName | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Drafts follow the saved values, so an unrelated update doesn't wipe typing.
  useEffect(() => setTitleDraft(issue.title), [issue.id, issue.title]);
  useEffect(() => setDescription(issue.description ?? ""), [issue.id, issue.description]);
  useEffect(() => {
    setEditingTitle(false);
    setOpenPicker(null);
  }, [issue.id]);

  const openIssue = (keyOrId: string) => {
    if (onOpenIssue) onOpenIssue(keyOrId);
    else router.push(issueHref(projectKey, keyOrId));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
      toast({ title: `Copied a link to ${issue.key}`, tone: "success", duration: 2500 });
    } catch {
      toast({ title: "Couldn't copy the link", tone: "danger" });
    }
  };

  const saveTitle = () => {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft.trim() !== issue.title) actions.setTitle(titleDraft);
    else setTitleDraft(issue.title);
  };

  // A, S, P open the assignee, status and priority pickers; I assigns to you;
  // ← and → step through the list the issue was opened from.
  const shortcutState = useRef({ lastG: 0 });
  const latest = useRef({
    canEdit,
    nav,
    openPicker,
    currentUserId: currentUser?.id,
    assigneeId: issue.assigneeId,
    setAssignee: actions.setAssignee,
  });
  latest.current = {
    canEdit,
    nav,
    openPicker,
    currentUserId: currentUser?.id,
    assigneeId: issue.assigneeId,
    setAssignee: actions.setAssignee,
  };
  useEffect(() => {
    if (!shortcuts) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = isTyping(e.target);
      const afterG = Date.now() - shortcutState.current.lastG < 1500;
      if (!typing && e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        shortcutState.current.lastG = Date.now();
        return;
      }
      shortcutState.current.lastG = 0;
      const state = latest.current;
      if (state.openPicker || inOtherWidget(e.target, rootRef.current)) return;

      if (!typing && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (e.key === "ArrowLeft" && state.nav?.onPrev && state.nav.index > 0) {
          e.preventDefault();
          state.nav.onPrev();
          return;
        }
        if (e.key === "ArrowRight" && state.nav?.onNext && state.nav.index < state.nav.total - 1) {
          e.preventDefault();
          state.nav.onNext();
          return;
        }
      }

      const shortcut = issueShortcutFor(e, { typing, afterG });
      if (!shortcut || !state.canEdit) return;
      e.preventDefault();
      if (shortcut === "assign-to-me") {
        if (state.currentUserId && state.assigneeId !== state.currentUserId) state.setAssignee(state.currentUserId);
      } else {
        setOpenPicker(shortcut);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts]);

  // Paste an image anywhere in the view (outside a text box) to attach it.
  const pasteImage = actions.pasteImage;
  const pasteRef = useRef(pasteImage);
  pasteRef.current = pasteImage;
  const canAttach = permissions.canAddComment;
  useEffect(() => {
    if (!shortcuts || !canAttach) return;
    const onPaste = async (e: ClipboardEvent) => {
      if (isTyping(document.activeElement)) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const file =
        Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/")) ??
        items.find((i) => i.type.startsWith("image/"))?.getAsFile();
      if (!file) return;
      e.preventDefault();
      const uploading = toast({ title: "Attaching the pasted image…", duration: 0 });
      const res = await pasteRef.current(file);
      dismissToast(uploading);
      if (res.success) toast({ title: `Attached ${res.fileName ?? "the image"}`, tone: "success", duration: 2500 });
      else toast({ title: "Couldn't attach the image", description: res.error, tone: "danger" });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast helpers are stable
  }, [shortcuts, canAttach]);

  const remove = async () => {
    setDeleting(true);
    const ok = await actions.remove();
    setDeleting(false);
    if (!ok) return;
    setConfirmDelete(false);
    toast({ title: `Deleted ${issue.key}`, tone: "success" });
    if (onClose) onClose();
    else if (variant === "page") router.push(`/projects/${projectKey}/issues`);
  };

  const TitleTag = variant === "page" ? "h1" : "h2";
  const layout = GRID[variant];
  // On a phone the property list starts folded behind a row of chips.
  const [allProperties, setAllProperties] = useState(false);
  // On a phone, swiping sideways steps to the previous or next issue.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || !nav || window.matchMedia("(min-width: 768px)").matches) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // A deliberate sideways swipe, not a scroll or a tap; not inside a text field.
    if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) / 2) return;
    if ((e.target as HTMLElement).closest("input, textarea, [contenteditable=true], [role=group]")) return;
    if (dx < 0 && nav.index < nav.total - 1) nav.onNext?.();
    if (dx > 0 && nav.index > 0) nav.onPrev?.();
  };

  return (
    <div ref={rootRef} className="flex min-h-0 flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Header: where the issue sits, and what you can do with it */}
      <div
        className={cn(
          "flex min-h-12 shrink-0 items-center gap-1.5 border-b border-subtle bg-surface px-3",
          "sticky top-0 z-10",
          variant === "page" && "-mx-4 mb-4 sm:-mx-8 sm:px-8"
        )}
      >
        {onBack && <IconButton label="Back to the previous issue" icon={<ArrowLeft />} size="sm" onClick={onBack} />}
        <nav aria-label="Issue" className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
          {issue.parent && (
            <>
              <button
                type="button"
                onClick={() => openIssue(issue.parent!.key)}
                title={`${issue.parent.key}: ${issue.parent.title}`}
                className="flex min-w-0 max-w-[40%] items-center gap-1 rounded-control px-1 py-0.5 text-ink-2 hover:bg-surface-sunk hover:text-ink"
              >
                <IssueTypeIcon type="EPIC" className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{issue.parent.title}</span>
              </button>
              <span aria-hidden="true" className="text-muted">
                /
              </span>
            </>
          )}
          <span className="flex shrink-0 items-center gap-1.5">
            <IssueTypeIcon type={issue.type} className="h-4 w-4" />
            {variant === "page" ? (
              <span className="font-mono text-xs font-medium text-ink-2">{issue.key}</span>
            ) : (
              <Link prefetch={false} href={href} className="font-mono text-xs font-medium text-ink-2 hover:text-ink hover:underline">
                {issue.key}
              </Link>
            )}
          </span>
        </nav>

        {nav && nav.total > 1 && nav.index >= 0 && (
          <div className="hidden shrink-0 items-center gap-0.5 md:flex">
            <span className="mr-1 font-mono text-[11px] text-ink-2">
              {nav.index + 1} of {nav.total}
            </span>
            <IconButton
              label={nav.prevKey ? `Previous issue, ${nav.prevKey}` : "Previous issue"}
              title="Previous issue (←)"
              icon={<ChevronLeft />}
              size="sm"
              disabled={nav.index <= 0}
              onClick={nav.onPrev}
            />
            <IconButton
              label={nav.nextKey ? `Next issue, ${nav.nextKey}` : "Next issue"}
              title="Next issue (→)"
              icon={<ChevronRight />}
              size="sm"
              disabled={nav.index >= nav.total - 1}
              onClick={nav.onNext}
            />
          </div>
        )}

        {currentUser && (
          <Button
            variant="ghost"
            size="sm"
            onClick={actions.toggleWatching}
            aria-pressed={data.watch.watching}
            title={data.watch.watching ? "Stop watching" : "Watch for updates"}
            className={cn(data.watch.watching && "text-accent")}
          >
            {data.watch.watching ? (
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="sr-only">{data.watch.watching ? "Watching" : "Watch"}</span>
            {data.watch.count > 0 && <span aria-label={`${data.watch.count} watching`}>{data.watch.count}</span>}
          </Button>
        )}

        <Menu>
          <MenuTrigger asChild>
            <IconButton label="More actions" icon={<MoreHorizontal />} size="sm" />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem icon={<Link2 aria-hidden="true" />} onSelect={copyLink}>
              Copy link
            </MenuItem>
            {variant !== "page" && (
              <MenuItem icon={<Maximize2 aria-hidden="true" />} onSelect={() => router.push(href)}>
                Open as page
              </MenuItem>
            )}
            {data.canDelete && (
              <>
                <MenuSeparator />
                <MenuItem danger icon={<Trash2 aria-hidden="true" />} onSelect={() => setConfirmDelete(true)}>
                  Delete issue
                </MenuItem>
              </>
            )}
          </MenuContent>
        </Menu>

        {variant !== "page" && (
          <Link
            prefetch={false}
            href={href}
            aria-label="Open as page"
            title="Open as page"
            className="hidden h-7 w-7 shrink-0 md:inline-flex items-center justify-center rounded-control text-ink-2 transition-colors hover:bg-surface-sunk hover:text-ink [&_svg]:h-4 [&_svg]:w-4"
          >
            <Maximize2 aria-hidden="true" />
          </Link>
        )}
        {onClose && <IconButton label="Close" title="Close (Esc)" icon={<X />} size="sm" onClick={onClose} />}
      </div>

      <div className={cn("flex flex-col gap-4", variant === "page" ? "" : "px-4 py-4 sm:px-5")}>
        {/* Title, edited in place */}
        <div className="group flex items-start gap-1">
          {editingTitle ? (
            <textarea
              autoFocus
              rows={1}
              aria-label="Title"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value.replace(/\n/g, " "))}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveTitle();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setTitleDraft(issue.title);
                  setEditingTitle(false);
                }
              }}
              className="w-full resize-none rounded-control border border-accent bg-surface px-2 py-1 text-xl font-semibold leading-7 text-ink [field-sizing:content]"
            />
          ) : (
            <>
              <TitleTag
                onClick={canEdit ? () => setEditingTitle(true) : undefined}
                className={cn(
                  "min-w-0 flex-1 break-words rounded-control px-2 py-1 text-xl font-semibold leading-7 text-ink",
                  canEdit && "cursor-text hover:bg-surface-sunk"
                )}
              >
                {issue.title}
              </TitleTag>
              {canEdit && (
                <IconButton
                  label="Edit title"
                  icon={<Pencil />}
                  size="sm"
                  onClick={() => setEditingTitle(true)}
                  className="mt-1 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                />
              )}
            </>
          )}
        </div>

        <div className={cn("grid grid-cols-1 gap-6", layout.grid)}>
          <div className="order-first md:hidden">
            <PropertyChips
              data={data}
              onOpen={(picker) => {
                setAllProperties(true);
                // Once the list is on screen, open the chip's picker.
                if (picker) setTimeout(() => setOpenPicker(picker), 0);
              }}
            />
          </div>
          <aside
            aria-label="Properties"
            className={cn("order-first border-b border-subtle pb-4", !allProperties && "max-md:hidden", layout.aside)}
          >
            <IssueProperties data={data} openPicker={openPicker} onOpenPickerChange={setOpenPicker} />
          </aside>

          <div className="flex min-w-0 flex-col gap-6">
            <IssueDescriptionEditor
              value={description}
              onChange={setDescription}
              users={data.users}
              mode="click-to-edit"
              canEdit={canEdit}
              onSave={() => actions.setDescription(description)}
              onCancel={() => setDescription(issue.description ?? "")}
              onImagePaste={actions.pasteImage}
              placeholder="Add details, steps or acceptance criteria…"
            />

            <div className="flex flex-col gap-3">
              <ChildIssuesSection
                parentIssue={issue}
                childIssues={issue.children as Issue[] | undefined}
                canEdit={canEdit}
                workflowStatuses={data.statuses}
                onChildAdded={sections.onChildAdded}
                onChildRemoved={sections.onChildRemoved}
                onOpenChild={openIssue}
              />
              <IssueLinksSection
                issueId={issue.id}
                linksAsSource={issue.linksAsSource}
                linksAsTarget={issue.linksAsTarget}
                canEdit={canEdit}
                onIssueLinked={sections.onIssueLinked}
                onIssueUnlinked={sections.onIssueUnlinked}
                onOpenIssue={openIssue}
              />
              <AttachmentsSection
                issueId={issue.id}
                attachments={issue.attachments}
                canUpload={permissions.canAddComment}
                canDelete={(a) => permissions.canModerate || a.uploadedById === currentUser?.id}
                onAttachmentAdded={sections.onAttachmentAdded}
                onAttachmentRemoved={sections.onAttachmentRemoved}
              />
            </div>

            <div className="border-t border-subtle pt-4">
              <IssueActivity data={data} />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent
          size="sm"
          title={`Delete ${issue.key}?`}
          description="The issue, its comments, history and attachments are deleted for everyone. This can't be undone."
          footer={
            <>
              <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="danger" loading={deleting} onClick={remove}>
                Delete issue
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-ink">{issue.title}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
