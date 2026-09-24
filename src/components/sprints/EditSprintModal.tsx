"use client";

import React, { useState, useEffect } from "react";
import { Sprint } from "@/types";
import { format } from "date-fns";
import { Calendar, Target, Clock, AlertCircle, X, Loader2, Pencil } from "lucide-react";
import { updateSprint } from "@/lib/actions/sprints";

interface EditSprintModalProps {
  sprint: Sprint;
  isOpen: boolean;
  onClose: () => void;
  onSprintUpdated?: (sprint: Sprint) => void;
}

export default function EditSprintModal({
  sprint,
  isOpen,
  onClose,
  onSprintUpdated,
}: EditSprintModalProps) {
  const [name, setName] = useState(sprint.name || "");
  const [durationMode, setDurationMode] = useState<string>("14");
  const [customDays, setCustomDays] = useState<number>(14);
  const [startDateStr, setStartDateStr] = useState<string>("");
  const [endDateStr, setEndDateStr] = useState<string>("");
  const [goal, setGoal] = useState(sprint.goal || "");
  const [dateError, setDateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sprint) return;

    setName(sprint.name || "");
    setGoal(sprint.goal || "");
    setDateError(null);
    setServerError(null);

    const initialStart = sprint.startDate
      ? format(new Date(sprint.startDate), "yyyy-MM-dd")
      : "";
    const initialEnd = sprint.endDate
      ? format(new Date(sprint.endDate), "yyyy-MM-dd")
      : "";

    setStartDateStr(initialStart);
    setEndDateStr(initialEnd);

    if (initialStart && initialEnd) {
      const start = new Date(initialStart + "T00:00:00");
      const end = new Date(initialEnd + "T00:00:00");
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        setCustomDays(diffDays);
        if ([7, 14, 21, 28].includes(diffDays)) {
          setDurationMode(String(diffDays));
        } else {
          setDurationMode("custom");
        }
      } else {
        setDurationMode("14");
        setCustomDays(14);
      }
    } else {
      setDurationMode("14");
      setCustomDays(14);
    }
  }, [isOpen, sprint]);

  if (!isOpen) return null;

  const handleDurationChange = (mode: string) => {
    setDurationMode(mode);
    setDateError(null);
    const baseStart = startDateStr ? new Date(startDateStr + "T00:00:00") : new Date();
    if (!startDateStr) {
      setStartDateStr(format(baseStart, "yyyy-MM-dd"));
    }
    const days = mode === "custom" ? customDays : parseInt(mode, 10);
    if (mode !== "custom") {
      setCustomDays(days);
    }
    const end = new Date(baseStart.getTime() + days * 24 * 60 * 60 * 1000);
    setEndDateStr(format(end, "yyyy-MM-dd"));
  };

  const handleCustomDaysChange = (days: number) => {
    const validDays = Math.max(1, Math.min(365, days));
    setCustomDays(validDays);
    setDurationMode("custom");
    setDateError(null);
    const baseStart = startDateStr ? new Date(startDateStr + "T00:00:00") : new Date();
    if (!startDateStr) {
      setStartDateStr(format(baseStart, "yyyy-MM-dd"));
    }
    const end = new Date(baseStart.getTime() + validDays * 24 * 60 * 60 * 1000);
    setEndDateStr(format(end, "yyyy-MM-dd"));
  };

  const handleStartDateChange = (newStart: string) => {
    setStartDateStr(newStart);
    setDateError(null);
    if (!newStart) return;
    const start = new Date(newStart + "T00:00:00");
    const days = durationMode === "custom" ? customDays : parseInt(durationMode, 10) || 14;
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    setEndDateStr(format(end, "yyyy-MM-dd"));
  };

  const handleEndDateChange = (newEnd: string) => {
    setEndDateStr(newEnd);
    if (!startDateStr || !newEnd) return;
    const start = new Date(startDateStr + "T00:00:00");
    const end = new Date(newEnd + "T00:00:00");
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      setDateError("End date must come after the start date");
    } else {
      setDateError(null);
      setCustomDays(diffDays);
      if ([7, 14, 21, 28].includes(diffDays)) {
        setDurationMode(String(diffDays));
      } else {
        setDurationMode("custom");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setServerError("Sprint name is required");
      return;
    }

    if (sprint.status === "ACTIVE" && (!startDateStr || !endDateStr)) {
      setDateError("An active sprint must have both a start date and an end date");
      return;
    }

    if (startDateStr && endDateStr) {
      const start = new Date(startDateStr + "T00:00:00");
      const end = new Date(endDateStr + "T00:00:00");
      if (end <= start) {
        setDateError("End date must come after the start date");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await updateSprint(sprint.id, {
        name: trimmedName,
        startDate: startDateStr ? new Date(startDateStr + "T00:00:00") : null,
        endDate: endDateStr ? new Date(endDateStr + "T23:59:59") : null,
        goal: goal.trim() || null,
      });

      if (!res.success) {
        setServerError(res.error || "Failed to update sprint");
        setIsSubmitting(false);
        return;
      }

      if (onSprintUpdated && res.sprint) {
        onSprintUpdated(res.sprint as unknown as Sprint);
      }
      onClose();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface w-full max-w-lg rounded-xl shadow-2xl border border-subtle p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-subtle">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent-soft/50 text-accent">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">Edit Sprint</h2>
              <p className="text-xs text-muted">
                Update sprint timeline, dates, and goal / target
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted hover:text-ink rounded hover:bg-surface-sunk transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {serverError && (
          <div className="p-3 bg-danger-soft border border-danger/30 rounded-md text-xs text-danger font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Sprint Name */}
          <div>
            <label className="block text-xs font-bold text-ink-2 uppercase tracking-wider mb-1.5">
              Sprint Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint 1"
              className="w-full border border-subtle rounded px-3 py-2 text-sm text-ink focus:border-accent font-medium"
            />
          </div>

          {/* Duration Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-ink-2 uppercase tracking-wider">
                Duration
              </label>
              {durationMode === "custom" && (
                <span className="text-xs font-bold text-accent">
                  Custom: {customDays} {customDays === 1 ? "day" : "days"}
                </span>
              )}
            </div>
            <select
              value={durationMode}
              onChange={(e) => handleDurationChange(e.target.value)}
              className="w-full border border-subtle rounded px-3 py-2 text-sm text-ink focus:border-accent bg-surface"
            >
              <option value="7">1 week (7 days)</option>
              <option value="14">2 weeks (14 days - Recommended)</option>
              <option value="21">3 weeks (21 days)</option>
              <option value="28">4 weeks (28 days)</option>
              <option value="custom">Custom time span</option>
            </select>
          </div>

          {/* Custom Duration Stepper & Quick Presets */}
          {durationMode === "custom" && (
            <div className="p-3 bg-accent-soft/40 border border-accent/20 rounded-lg space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  Set Custom Number of Days
                </span>
                <span className="text-ink-2">Calculates end date automatically</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={customDays}
                    onChange={(e) => handleCustomDaysChange(parseInt(e.target.value, 10) || 1)}
                    className="w-24 border border-subtle rounded px-3 py-1.5 text-sm font-semibold text-ink focus:border-accent"
                  />
                  <span className="ml-2 text-xs font-medium text-ink-2">
                    {customDays === 1 ? "day" : "days"}
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1 flex-wrap">
                  {[3, 5, 10, 15, 30, 45].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleCustomDaysChange(d)}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                        customDays === d
                          ? "bg-accent text-accent-fg border-accent font-semibold shadow-xs"
                          : "bg-surface text-ink-2 border-subtle hover:bg-surface-sunk"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Start Date & End Date Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink-2 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-muted" />
                Start Date {sprint.status === "ACTIVE" && <span className="text-danger">*</span>}
              </label>
              <input
                type="date"
                value={startDateStr}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full border border-subtle rounded px-3 py-2 text-sm text-ink focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-2 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-muted" />
                End Date {sprint.status === "ACTIVE" && <span className="text-danger">*</span>}
              </label>
              <input
                type="date"
                value={endDateStr}
                min={startDateStr}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-full border border-subtle rounded px-3 py-2 text-sm text-ink focus:border-accent"
              />
            </div>
          </div>

          {/* Date Error */}
          {dateError && (
            <div className="p-2.5 bg-danger-soft border border-danger/30 rounded text-xs text-danger font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{dateError}</span>
            </div>
          )}

          {/* Timeline Summary Preview */}
          {startDateStr && endDateStr && !dateError && (
            <div className="px-3 py-2 bg-page border border-subtle rounded-md text-xs text-ink-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted" />
                Sprint Timeline:
              </span>
              <span className="font-semibold text-ink">
                {customDays} {customDays === 1 ? "day" : "days"} (
                {format(new Date(startDateStr + "T00:00:00"), "MMM d, yyyy")} –{" "}
                {format(new Date(endDateStr + "T00:00:00"), "MMM d, yyyy")})
              </span>
            </div>
          )}

          {/* Sprint Goal / Target */}
          <div>
            <label className="block text-xs font-bold text-ink-2 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-accent" />
              Sprint Goal / Target
            </label>
            <textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What does the team aim to achieve in this sprint?"
              className="w-full border border-subtle rounded p-2.5 text-sm text-ink focus:border-accent placeholder:text-muted"
            />
            <p className="text-[11px] text-muted mt-1">
              The sprint target is displayed on the board and backlog to align team deliverables.
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-subtle">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-subtle rounded text-sm text-ink-2 hover:bg-surface-sunk font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!dateError}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-fg rounded text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Sprint</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
