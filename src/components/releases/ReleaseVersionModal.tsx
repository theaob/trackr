"use client";

import { todayKey } from "@/lib/calendarDate";
import React, { useState } from "react";
import { Version } from "@/types";
import { releaseVersion } from "@/lib/actions/versions";
import { Rocket, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";

interface ReleaseVersionModalProps {
  version: Version;
  otherVersions: Version[];
  isOpen: boolean;
  onClose: () => void;
  onReleased: (updatedVersion: Version) => void;
}

export default function ReleaseVersionModal({
  version,
  otherVersions,
  isOpen,
  onClose,
  onReleased,
}: ReleaseVersionModalProps) {
  // Today where the viewer is; toISOString() would give UTC's date, which is
  // already tomorrow on a US evening.
  const [releaseDate, setReleaseDate] = useState(() => todayKey());

  const unresolvedCount =
    (version.issueCount?.total || 0) - (version.issueCount?.done || 0);

  const availableTargetVersions = otherVersions.filter(
    (v) => v.id !== version.id && v.status === "UNRELEASED"
  );

  const [moveAction, setMoveAction] = useState<"move" | "ignore" | "clear">(
    availableTargetVersions.length > 0 ? "move" : "ignore"
  );
  const [targetVersionId, setTargetVersionId] = useState<string>(
    availableTargetVersions.length > 0 ? availableTargetVersions[0].id : ""
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let moveUnresolvedToVersionId: string | null | undefined = undefined;
      if (unresolvedCount > 0) {
        if (moveAction === "move") {
          moveUnresolvedToVersionId = targetVersionId || null;
        } else if (moveAction === "clear") {
          moveUnresolvedToVersionId = null;
        }
      }

      const res = await releaseVersion(version.id, {
        releaseDate,
        moveUnresolvedToVersionId,
      });

      if (res.success && res.version) {
        onReleased(res.version as unknown as Version);
        onClose();
      } else {
        setError(res.error || "Failed to release version");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const radio = "h-4 w-4 accent-[rgb(var(--color-accent))]";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={`Release ${version.name}`}
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" form="release-form" variant="primary" loading={isSubmitting}>
              {!isSubmitting && <Rocket className="h-3.5 w-3.5" aria-hidden="true" />}
              Release
            </Button>
          </>
        }
      >
        <form id="release-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          <Field label="Release date" required>
            <Input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
          </Field>

          {unresolvedCount > 0 ? (
            <fieldset className="space-y-2 rounded-control border border-warning/40 bg-warning-soft p-3 text-[13px] text-ink">
              <legend className="sr-only">Unresolved issues</legend>
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <span>
                  {unresolvedCount} issue{unresolvedCount === 1 ? " isn't" : "s aren't"} done yet. What should happen to{" "}
                  {unresolvedCount === 1 ? "it" : "them"}?
                </span>
              </p>
              {availableTargetVersions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="moveAction" checked={moveAction === "move"} onChange={() => setMoveAction("move")} className={radio} />
                    Move to
                  </label>
                  <Select
                    aria-label="Version to move them to"
                    className="w-auto min-w-40"
                    value={targetVersionId}
                    onChange={(v) => {
                      setTargetVersionId(v);
                      setMoveAction("move");
                    }}
                    options={availableTargetVersions.map((v) => ({ value: v.id, label: v.name }))}
                  />
                </div>
              )}
              <label className="flex items-center gap-2">
                <input type="radio" name="moveAction" checked={moveAction === "ignore"} onChange={() => setMoveAction("ignore")} className={radio} />
                Keep them in {version.name}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="moveAction" checked={moveAction === "clear"} onChange={() => setMoveAction("clear")} className={radio} />
                Remove the version from them
              </label>
            </fieldset>
          ) : (
            <p className="rounded-control bg-success-soft px-3 py-2 text-[13px] text-success">Every issue in this version is done.</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
