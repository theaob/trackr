"use client";

import React, { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Worklog } from "@/types";
import { updateIssue } from "@/lib/actions/issues";
import { logWork, deleteWorklog } from "@/lib/actions/worklogs";
import { formatDuration, parseDuration } from "@/lib/duration";
import UserAvatar from "@/components/common/UserAvatar";
import { Clock, Plus, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { formatCalendarDate } from "@/lib/calendarDate";

interface TimeTrackingFieldProps {
  issueId: string;
  originalEstimateSeconds: number | null;
  remainingEstimateSeconds: number | null;
  worklogs?: Worklog[];
  canEdit: boolean;
  canLogWork: boolean;
  isAdmin: boolean;
  currentUserId?: string;
  onEstimatesChanged: (originalEstimateSeconds: number | null, remainingEstimateSeconds: number | null) => void;
  onWorklogAdded: (worklog: Worklog, remainingEstimateSeconds: number | null) => void;
  onWorklogRemoved: (worklogId: string, remainingEstimateSeconds: number | null) => void;
}

function EstimateInput({
  label,
  value,
  disabled,
  onSave,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onSave: (seconds: number | null) => Promise<string | void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value != null ? formatDuration(value) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    if (disabled) return;
    setText(value != null ? formatDuration(value) : "");
    setError(null);
    setEditing(true);
  };

  const commit = async () => {
    const trimmed = text.trim();
    if (trimmed === "") {
      setSaving(true);
      const err = await onSave(null);
      setSaving(false);
      if (err) {
        setError(err);
        return;
      }
      setEditing(false);
      return;
    }
    const seconds = parseDuration(trimmed);
    if (seconds === null) {
      setError('Use a duration like "2d 4h" (w/d/h/m).');
      return;
    }
    setSaving(true);
    const err = await onSave(seconds);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        disabled={disabled}
        className={`text-xs text-left ${
          disabled ? "cursor-default" : "hover:underline cursor-pointer"
        } text-ink`}
      >
        <span className="text-muted">{label}: </span>
        <span className="font-semibold">{value != null ? formatDuration(value) : "None"}</span>
      </button>
    );
  }

  return (
    <div className="flex-1 min-w-[7rem]">
      <input
        type="text"
        autoFocus
        value={text}
        disabled={saving}
        placeholder="e.g. 2d 4h"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setEditing(false);
            setError(null);
          }
        }}
        className="w-full px-1.5 py-0.5 text-xs border border-accent rounded text-ink"
      />
      {error && <p className="text-[10px] text-rose-600 mt-0.5">{error}</p>}
    </div>
  );
}

export default function TimeTrackingField({
  issueId,
  originalEstimateSeconds,
  remainingEstimateSeconds,
  worklogs = [],
  canEdit,
  canLogWork,
  isAdmin,
  currentUserId,
  onEstimatesChanged,
  onWorklogAdded,
  onWorklogRemoved,
}: TimeTrackingFieldProps) {
  const [logging, setLogging] = useState(false);
  const [timeSpentText, setTimeSpentText] = useState("");
  const [workDate, setWorkDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [showWorklogs, setShowWorklogs] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loggedSeconds = worklogs.reduce((sum, w) => sum + w.timeSpentSeconds, 0);
  const original = originalEstimateSeconds ?? 0;
  const remaining = remainingEstimateSeconds ?? 0;
  const hasAnyTracking = originalEstimateSeconds != null || remainingEstimateSeconds != null || loggedSeconds > 0;
  const overrun = original > 0 && loggedSeconds > original;
  const denom = Math.max(original, loggedSeconds + remaining, 1);
  const loggedPct = Math.min(100, (loggedSeconds / denom) * 100);
  const remainingPct = Math.min(100 - loggedPct, (remaining / denom) * 100);

  const saveOriginal = async (seconds: number | null): Promise<string | void> => {
    const prevOriginal = originalEstimateSeconds;
    const prevRemaining = remainingEstimateSeconds;
    const nextRemaining = prevRemaining ?? seconds;
    onEstimatesChanged(seconds, nextRemaining);

    const res = await updateIssue(issueId, { originalEstimateSeconds: seconds });
    if (!res.success || !res.issue) {
      onEstimatesChanged(prevOriginal, prevRemaining);
      return res.error || "Failed to save estimate.";
    }
    const issue = res.issue as { originalEstimateSeconds: number | null; remainingEstimateSeconds: number | null };
    onEstimatesChanged(issue.originalEstimateSeconds, issue.remainingEstimateSeconds);
  };

  const saveRemaining = async (seconds: number | null): Promise<string | void> => {
    const prevOriginal = originalEstimateSeconds;
    const prevRemaining = remainingEstimateSeconds;
    onEstimatesChanged(prevOriginal, seconds);

    const res = await updateIssue(issueId, { remainingEstimateSeconds: seconds });
    if (!res.success || !res.issue) {
      onEstimatesChanged(prevOriginal, prevRemaining);
      return res.error || "Failed to save estimate.";
    }
    const issue = res.issue as { originalEstimateSeconds: number | null; remainingEstimateSeconds: number | null };
    onEstimatesChanged(issue.originalEstimateSeconds, issue.remainingEstimateSeconds);
  };

  const handleLogWork = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogError(null);
    const seconds = parseDuration(timeSpentText.trim());
    if (seconds === null || seconds <= 0) {
      setLogError('Enter a duration like "2h 30m".');
      return;
    }
    setSubmitting(true);
    const res = await logWork(issueId, {
      timeSpentSeconds: seconds,
      description: description.trim() || undefined,
      workDate,
    });
    setSubmitting(false);
    if (res.success && res.worklog) {
      onWorklogAdded(res.worklog as unknown as Worklog, res.remainingEstimateSeconds ?? null);
      setTimeSpentText("");
      setDescription("");
      setWorkDate(format(new Date(), "yyyy-MM-dd"));
      setLogging(false);
      setShowWorklogs(true);
    } else {
      setLogError((res as { error?: string }).error || "Failed to log work.");
    }
  };

  const handleDeleteWorklog = async (worklogId: string) => {
    const targetWorklog = worklogs.find((w) => w.id === worklogId);
    const prevRemaining = remainingEstimateSeconds;
    const restoredRemaining =
      prevRemaining != null && targetWorklog
        ? prevRemaining + targetWorklog.timeSpentSeconds
        : prevRemaining;

    // Optimistic removal
    onWorklogRemoved(worklogId, restoredRemaining);

    const res = await deleteWorklog(worklogId);
    if (res.success) {
      if (res.remainingEstimateSeconds !== undefined) {
        onEstimatesChanged(originalEstimateSeconds, res.remainingEstimateSeconds ?? null);
      }
    } else {
      // Rollback
      if (targetWorklog) {
        onWorklogAdded(targetWorklog, prevRemaining);
      }
      alert(res.error || "Failed to delete worklog.");
    }
  };

  return (
    <div>
      <label className="block text-xs font-bold text-ink-2 uppercase tracking-wider mb-1.5 flex items-center gap-1">
        <Clock className="w-3 h-3 text-accent" />
        Time Tracking
      </label>

      {hasAnyTracking && (
        <div className="mb-2">
          <div className="w-full h-1.5 bg-subtle rounded-full overflow-hidden flex">
            {loggedPct > 0 && (
              <div className={overrun ? "bg-rose-500" : "bg-accent"} style={{ width: `${loggedPct}%` }} />
            )}
            {remainingPct > 0 && <div className="bg-strong" style={{ width: `${remainingPct}%` }} />}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-ink-2">
            <span>
              <span className={`font-semibold ${overrun ? "text-rose-600" : "text-ink"}`}>
                {formatDuration(loggedSeconds)}
              </span>{" "}
              logged
            </span>
            {remainingEstimateSeconds != null && (
              <span>
                <span className="font-semibold text-ink">{formatDuration(remaining)}</span> remaining
              </span>
            )}
            {originalEstimateSeconds != null && (
              <span>
                <span className="font-semibold text-ink">{formatDuration(original)}</span> estimated
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <EstimateInput label="Original" value={originalEstimateSeconds} disabled={!canEdit} onSave={saveOriginal} />
        <EstimateInput label="Remaining" value={remainingEstimateSeconds} disabled={!canEdit} onSave={saveRemaining} />
      </div>

      <div className="mt-1.5 flex items-center gap-3">
        {canLogWork && !logging && (
          <button
            type="button"
            onClick={() => setLogging(true)}
            className="text-[11px] text-accent hover:underline font-semibold flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" />
            Log work
          </button>
        )}
        {worklogs.length > 0 && (
          <button
            type="button"
            onClick={() => setShowWorklogs((v) => !v)}
            className="text-[11px] text-ink-2 hover:text-ink font-medium flex items-center gap-0.5"
          >
            {showWorklogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Work log ({worklogs.length})
          </button>
        )}
      </div>

      {logging && (
        <form
          onSubmit={handleLogWork}
          className="mt-2 p-2.5 border border-subtle rounded-md bg-page/70 space-y-1.5"
        >
          {logError && <p className="text-[11px] text-rose-600 font-medium">{logError}</p>}
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Time spent, e.g. 2h 30m"
              value={timeSpentText}
              onChange={(e) => setTimeSpentText(e.target.value)}
              className="flex-1 text-xs px-2 py-1.5 border border-subtle rounded focus:border-accent"
            />
            <input
              type="date"
              value={workDate}
              max={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => setWorkDate(e.target.value)}
              className="text-xs px-2 py-1.5 border border-subtle rounded focus:border-accent"
            />
          </div>
          <input
            type="text"
            placeholder="What did you work on? (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full text-xs px-2 py-1.5 border border-subtle rounded focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="text-xs font-semibold px-3 py-1.5 rounded bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Log
            </button>
            <button
              type="button"
              onClick={() => {
                setLogging(false);
                setLogError(null);
              }}
              className="text-xs text-ink-2 hover:text-ink font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {showWorklogs && worklogs.length > 0 && (
        <div className="mt-2 space-y-1.5 max-h-52 overflow-y-auto">
          {worklogs.map((w) => (
            <div key={w.id} className="group flex items-start gap-2 text-[11px] p-1.5 rounded hover:bg-page">
              <UserAvatar user={w.author} size="xs" className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-ink">{w.author.name}</span>
                  <span className="text-muted">logged</span>
                  <span className="font-semibold text-ink">{formatDuration(w.timeSpentSeconds)}</span>
                </div>
                {w.description && <p className="text-ink-2 mt-0.5">{w.description}</p>}
                <span className="text-[10px] text-muted">
                  {formatCalendarDate(w.workDate, "MMM d, yyyy")} &middot;{" "}
                  {formatDistanceToNow(new Date(w.createdAt), { addSuffix: true })}
                </span>
              </div>
              {(isAdmin || w.authorId === currentUserId) && (
                <button
                  type="button"
                  onClick={() => handleDeleteWorklog(w.id)}
                  disabled={deletingId === w.id}
                  title="Delete worklog"
                  className="text-muted hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                >
                  {deletingId === w.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
