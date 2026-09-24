"use client";

import { calendarDateToLocal } from "@/lib/calendarDate";
import React, { useState, useEffect } from "react";
import { Version } from "@/types";
import { getVersionReleaseNotesData } from "@/lib/actions/versions";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import {
  Copy,
  Check,
  Download,
  Sparkles,
  Bug,
  Wrench,
  Users,
  Loader2,
  Code,
  Eye,
} from "lucide-react";

interface ReleaseNotesModalProps {
  version: Version;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReleaseNotesModal({
  version,
  isOpen,
  onClose,
}: ReleaseNotesModalProps) {
  const [data, setData] = useState<{
    features: any[];
    bugs: any[];
    technical: any[];
    contributors: any[];
    markdown: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "markdown">("preview");

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    setIsLoading(true);

    getVersionReleaseNotesData(version.id).then((res) => {
      if (!isCancelled && res) {
        setData(res);
        setIsLoading(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [version.id, isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!data?.markdown) return;
    navigator.clipboard.writeText(data.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!data?.markdown) return;
    const blob = new Blob([data.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Release-Notes-${version.name.replace(/\s+/g, "-")}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const released = version.releaseDate
    ? `Released ${calendarDateToLocal(version.releaseDate)?.toLocaleDateString()}`
    : "Not released yet";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="xl"
        title={`Release notes: ${version.name}`}
        description={released}
        footer={
          <>
            {data && <span className="mr-auto text-xs text-muted">{data.features.length + data.bugs.length + data.technical.length} issues</span>}
            <Button onClick={handleDownload} disabled={!data}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download .md
            </Button>
            <Button variant="primary" onClick={handleCopy} disabled={!data}>
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              {copied ? "Copied" : "Copy Markdown"}
            </Button>
          </>
        }
      >
        <div className="mb-4">
          <Segmented
            label="Show release notes as"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: "preview", label: "Preview", icon: <Eye aria-hidden="true" /> },
              { value: "markdown", label: "Markdown", icon: <Code aria-hidden="true" /> },
            ]}
          />
        </div>
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-muted gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <span className="text-xs">Generating release notes...</span>
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-xs text-muted">
              No issues or details found for this release version.
            </div>
          ) : activeTab === "markdown" ? (
            /* Raw Markdown Textarea */
            <div className="relative">
              <textarea
                readOnly
                aria-label="Release notes in Markdown"
                value={data.markdown}
                className="w-full h-[450px] font-mono text-xs p-4 bg-page border border-subtle rounded-md resize-none leading-relaxed text-ink select-all"
              />
            </div>
          ) : (
            /* Rich Formatted Preview */
            <div className="space-y-6 max-w-2xl mx-auto">
              {/* Release Header Card */}
              <div className="p-4 bg-accent-soft/30 border border-accent/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <span>Release {version.name}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent text-accent-fg">
                      {version.status}
                    </span>
                  </h3>
                  <span className="text-xs text-ink-2 font-medium">
                    {version.releaseDate
                      ? calendarDateToLocal(version.releaseDate)?.toLocaleDateString()
                      : "Pending"}
                  </span>
                </div>
                {version.description && (
                  <p className="text-xs text-ink-2 mt-2 italic">
                    &ldquo;{version.description}&rdquo;
                  </p>
                )}
              </div>

              {/* Features & Enhancements */}
              {data.features.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-warning" />
                    Features & Enhancements ({data.features.length})
                  </h4>
                  <ul className="divide-y divide-subtle border border-subtle rounded-lg overflow-hidden bg-surface text-xs">
                    {data.features.map((issue) => (
                      <li key={issue.id} className="p-3 flex items-start justify-between gap-3 hover:bg-page">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-accent">{issue.key}</span>
                            <span className="font-semibold text-ink">{issue.title}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {issue.storyPoints !== null && (
                            <span className="px-1.5 py-0.5 rounded bg-surface-sunk font-bold text-[10px] text-ink-2">
                              {issue.storyPoints} pts
                            </span>
                          )}
                          {issue.assignee && (
                            <span className="text-muted text-[11px]">
                              {issue.assignee.name}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bug Fixes */}
              {data.bugs.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-2 flex items-center gap-1.5">
                    <Bug className="w-4 h-4 text-danger" />
                    Bug Fixes ({data.bugs.length})
                  </h4>
                  <ul className="divide-y divide-subtle border border-subtle rounded-lg overflow-hidden bg-surface text-xs">
                    {data.bugs.map((issue) => (
                      <li key={issue.id} className="p-3 flex items-start justify-between gap-3 hover:bg-page">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-accent">{issue.key}</span>
                          <span className="font-semibold text-ink">{issue.title}</span>
                        </div>
                        {issue.assignee && (
                          <span className="text-muted text-[11px] shrink-0">
                            {issue.assignee.name}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Technical Improvements */}
              {data.technical.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-2 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-ink-2" />
                    Technical Improvements & Subtasks ({data.technical.length})
                  </h4>
                  <ul className="divide-y divide-subtle border border-subtle rounded-lg overflow-hidden bg-surface text-xs">
                    {data.technical.map((issue) => (
                      <li key={issue.id} className="p-3 flex items-start justify-between gap-3 hover:bg-page">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-accent">{issue.key}</span>
                          <span className="font-semibold text-ink">{issue.title}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contributors */}
              {data.contributors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-2 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-accent" />
                    Contributors ({data.contributors.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {data.contributors.map((c, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1 bg-surface-sunk border border-subtle rounded-full text-xs font-medium text-ink flex items-center gap-1.5"
                      >
                        <div className="w-4 h-4 rounded-full bg-accent text-accent-fg text-[9px] font-bold flex items-center justify-center">
                          {c.name.charAt(0)}
                        </div>
                        <span>{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}
