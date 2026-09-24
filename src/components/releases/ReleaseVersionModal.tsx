"use client";

import { todayKey } from "@/lib/calendarDate";
import React, { useState } from "react";
import { Version } from "@/types";
import { releaseVersion } from "@/lib/actions/versions";
import { X, Rocket, AlertTriangle, Calendar, Loader2 } from "lucide-react";

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-surface rounded-lg shadow-xl border border-subtle w-full max-w-md overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-success" />
            <h2 className="text-base font-bold text-ink">
              Release Version {version.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink p-1 rounded hover:bg-surface-sunk transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded text-xs text-danger font-medium">
              {error}
            </div>
          )}

          {/* Release Date */}
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-muted" />
              Release Date
            </label>
            <input
              type="date"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-surface border border-subtle rounded focus:border-accent"
              required
            />
          </div>

          {/* Unresolved Issues Notice */}
          {unresolvedCount > 0 ? (
            <div className="p-3 bg-warning/15 border border-warning/40 rounded-md space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div className="text-xs text-ink font-medium">
                  There {unresolvedCount === 1 ? "is" : "are"}{" "}
                  <strong>{unresolvedCount} unresolved</strong> issue
                  {unresolvedCount === 1 ? "" : "s"} in this version.
                </div>
              </div>

              <div className="text-xs space-y-2 pt-1 border-t border-warning/30">
                {availableTargetVersions.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="moveAction"
                      checked={moveAction === "move"}
                      onChange={() => setMoveAction("move")}
                      className="text-accent focus:ring-accent"
                    />
                    <span>Move unresolved issues to:</span>
                    <select
                      value={targetVersionId}
                      onChange={(e) => {
                        setTargetVersionId(e.target.value);
                        setMoveAction("move");
                      }}
                      className="ml-auto bg-surface border border-subtle rounded px-2 py-1 text-xs"
                    >
                      {availableTargetVersions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="moveAction"
                    checked={moveAction === "ignore"}
                    onChange={() => setMoveAction("ignore")}
                    className="text-accent focus:ring-accent"
                  />
                  <span>Keep unresolved issues in {version.name}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="moveAction"
                    checked={moveAction === "clear"}
                    onChange={() => setMoveAction("clear")}
                    className="text-accent focus:ring-accent"
                  />
                  <span>Unassign version from unresolved issues</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-success/10 border border-success/30 rounded-md text-xs text-success font-semibold flex items-center gap-2">
              <span>All issues in this version are completed!</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium px-4 py-2 rounded text-ink-2 hover:bg-surface-sunk transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-xs font-semibold px-4 py-2 rounded bg-success text-accent-fg hover:bg-success/90 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Rocket className="w-3.5 h-3.5" />
              )}
              Release
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
