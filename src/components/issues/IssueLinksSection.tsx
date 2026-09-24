"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { issueHref, projectKeyOfIssue } from "@/lib/issueUrls";
import SectionHeader, { SectionAction } from "./SectionHeader";
import { IssueLink, LinkedIssueSummary } from "@/types";
import { IssueTypeBadge, StatusBadge } from "@/components/common/IssueIcons";
import { createIssueLink, deleteIssueLink, searchLinkableIssues } from "@/lib/actions/issueLinks";
import { describeIssueLink, ISSUE_LINK_TYPES, IssueLinkType } from "@/lib/issueLinks";
import { Plus, X, Loader2, Search } from "lucide-react";

interface LinkRow {
  linkId: string;
  direction: "outward" | "inward";
  type: string;
  issue: LinkedIssueSummary;
}

interface IssueLinksSectionProps {
  issueId: string;
  linksAsSource?: IssueLink[];
  linksAsTarget?: IssueLink[];
  canEdit: boolean;
  onIssueLinked: (link: IssueLink) => void;
  onIssueUnlinked: (linkId: string) => void;
  /** Opens a linked issue where the view is (the side panel); otherwise its page. */
  onOpenIssue?: (issueKey: string) => void;
}

export default function IssueLinksSection({
  issueId,
  linksAsSource = [],
  linksAsTarget = [],
  canEdit,
  onIssueLinked,
  onIssueUnlinked,
  onOpenIssue,
}: IssueLinksSectionProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [linkType, setLinkType] = useState<IssueLinkType>("BLOCKS");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkedIssueSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!adding) {
      setResults([]);
      return;
    }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await searchLinkableIssues(issueId, query);
      setResults(res as unknown as LinkedIssueSummary[]);
      setSearching(false);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, adding, issueId]);

  const rows: LinkRow[] = [
    ...linksAsSource
      .filter((l) => l.target)
      .map((l) => ({ linkId: l.id, direction: "outward" as const, type: l.type, issue: l.target! })),
    ...linksAsTarget
      .filter((l) => l.source)
      .map((l) => ({ linkId: l.id, direction: "inward" as const, type: l.type, issue: l.source! })),
  ];

  const resetAddForm = () => {
    setAdding(false);
    setQuery("");
    setResults([]);
    setError(null);
  };

  const handlePick = async (target: LinkedIssueSummary) => {
    setSubmitting(true);
    setError(null);
    const res = await createIssueLink({ issueId, targetIssueId: target.id, type: linkType });
    setSubmitting(false);
    if (res.success) {
      onIssueLinked(res.link as unknown as IssueLink);
      resetAddForm();
    } else {
      setError(res.error || "Failed to link issue.");
    }
  };

  const handleRemove = async (linkId: string) => {
    const res = await deleteIssueLink(linkId);
    if (res.success) onIssueUnlinked(linkId);
  };

  const handleOpen = (issue: LinkedIssueSummary) => {
    if (onOpenIssue) onOpenIssue(issue.key);
    else router.push(issueHref(issue.project?.key ?? projectKeyOfIssue(issue.key), issue.key));
  };

  if (rows.length === 0 && !canEdit) return null;

  return (
    <div className="min-w-0">
      <SectionHeader title="Linked issues" count={rows.length} className="mb-1">
        {canEdit && !adding && (
          <SectionAction icon={<Plus aria-hidden="true" />} onClick={() => setAdding(true)}>
            Add link
          </SectionAction>
        )}
      </SectionHeader>

      {adding && (
        <div className="mb-3 p-3 border border-subtle rounded-md bg-page/70 space-y-2 min-w-0">
          {error && <div className="text-[11px] text-danger font-medium">{error}</div>}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-w-0">
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value as IssueLinkType)}
              className="bg-surface border border-subtle rounded px-2 py-1.5 text-xs text-ink focus:border-accent shrink-0"
            >
              {ISSUE_LINK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {describeIssueLink(t, "outward")}
                </option>
              ))}
            </select>
            <div className="relative flex-1 min-w-[140px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by issue or epic key or title..."
                className="w-full pl-8 pr-2 py-1.5 text-xs border border-subtle rounded focus:border-accent text-ink"
              />
            </div>
            <button
              onClick={resetAddForm}
              className="p-1.5 text-muted hover:text-ink hover:bg-surface-sunk rounded shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {searching && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted py-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Searching...</span>
            </div>
          )}

          {!searching && results.length === 0 && (
            <div className="text-[11px] text-muted py-1">No matching issues or epics found.</div>
          )}

          {results.length > 0 && (
            <div className="border border-subtle rounded divide-y divide-subtle max-h-48 overflow-y-auto bg-surface min-w-0">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => handlePick(r)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-page disabled:opacity-50 min-w-0"
                >
                  <IssueTypeBadge type={r.type} />
                  <span className="text-[11px] font-mono text-muted shrink-0">{r.key}</span>
                  <span className="text-xs text-ink truncate flex-1">{r.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {rows.length > 0 ? (
        <div className="space-y-1.5 min-w-0">
          {rows.map((row) => (
            <div
              key={`${row.linkId}-${row.direction}`}
              className="flex items-center gap-2 px-2.5 py-1.5 border border-subtle rounded-md bg-surface hover:border-subtle group min-w-0"
            >
              <button
                type="button"
                onClick={() => handleOpen(row.issue)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left overflow-hidden"
              >
                <span className="text-[11px] text-muted w-24 sm:w-28 shrink-0 truncate">
                  {describeIssueLink(row.type, row.direction)}
                </span>
                <IssueTypeBadge type={row.issue.type} />
                <span className="text-[11px] font-mono text-muted shrink-0">
                  {row.issue.key}
                </span>
                <span className="text-xs text-ink truncate flex-1 hover:underline">
                  {row.issue.title}
                </span>
              </button>
              <StatusBadge status={row.issue.status} color={row.issue.statusColor} className="shrink-0" />
              {canEdit && (
                <button
                  onClick={() => handleRemove(row.linkId)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-danger hover:bg-danger-soft rounded transition-opacity shrink-0"
                  title="Remove link"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
