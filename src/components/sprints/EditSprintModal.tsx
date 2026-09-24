"use client";

import React, { useState, useEffect } from "react";
import { Sprint } from "@/types";
import { format } from "date-fns";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
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

  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Edit sprint"
        footer={
          <>
            <Button onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="sprint-form" variant="primary" loading={isSubmitting} disabled={!!dateError}>
              Save sprint
            </Button>
          </>
        }
      >
        <form id="sprint-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          {serverError && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-xs text-danger">
              {serverError}
            </p>
          )}
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 1" />
          </Field>

          <Field label="Length">
            <Select
              value={durationMode}
              onChange={handleDurationChange}
              options={[
                { value: "7", label: "1 week" },
                { value: "14", label: "2 weeks" },
                { value: "21", label: "3 weeks" },
                { value: "28", label: "4 weeks" },
                { value: "custom", label: "Custom", description: durationMode === "custom" ? days(customDays) : undefined },
              ]}
            />
          </Field>

          {durationMode === "custom" && (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Days" className="w-24">
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={customDays}
                  onChange={(e) => handleCustomDaysChange(parseInt(e.target.value, 10) || 1)}
                />
              </Field>
              <div role="group" aria-label="Common lengths" className="flex flex-wrap gap-1 pb-0.5">
                {[3, 5, 10, 15, 30, 45].map((d) => (
                  <Button key={d} size="sm" variant={customDays === d ? "primary" : "secondary"} aria-pressed={customDays === d} onClick={() => handleCustomDaysChange(d)}>
                    {days(d)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" required={sprint.status === "ACTIVE"}>
              <Input type="date" value={startDateStr} onChange={(e) => handleStartDateChange(e.target.value)} />
            </Field>
            <Field label="End date" required={sprint.status === "ACTIVE"} error={dateError}>
              <Input type="date" value={endDateStr} min={startDateStr} onChange={(e) => handleEndDateChange(e.target.value)} />
            </Field>
          </div>

          {startDateStr && endDateStr && !dateError && (
            <p className="text-xs text-ink-2">
              {days(customDays)}: {format(new Date(startDateStr + "T00:00:00"), "MMM d, yyyy")} to{" "}
              {format(new Date(endDateStr + "T00:00:00"), "MMM d, yyyy")}
            </p>
          )}

          <Field label="Goal" hint="Shown on the board and the backlog.">
            <Textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What the team aims to finish in this sprint" />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
