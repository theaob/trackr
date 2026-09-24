"use client";

import { calendarDateToLocal } from "@/lib/calendarDate";
import React, { useState, useEffect } from "react";
import { Version } from "@/types";
import { getVersionReleaseNotesData } from "@/lib/actions/versions";
import {
  X,
  FileText,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-lg shadow-xl border border-jira-gray-200 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-jira-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-jira-blue" />
            <div>
              <h2 className="text-base font-bold text-jira-navy">
                Release Notes: {version.name}
              </h2>
              <p className="text-[11px] text-jira-gray-500">
                {version.releaseDate
                  ? `Released on ${calendarDateToLocal(version.releaseDate)?.toLocaleDateString()}`
                  : "Unreleased"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switchers */}
            <div className="flex items-center bg-jira-gray-100 p-0.5 rounded border border-jira-gray-300">
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeTab === "preview"
                    ? "bg-white text-jira-blue shadow-xs"
                    : "text-jira-gray-600 hover:text-jira-navy"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
              <button
                onClick={() => setActiveTab("markdown")}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeTab === "markdown"
                    ? "bg-white text-jira-blue shadow-xs"
                    : "text-jira-gray-600 hover:text-jira-navy"
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Markdown
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-jira-gray-500 hover:text-jira-navy p-1 rounded hover:bg-jira-gray-100 transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-jira-gray-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-jira-blue" />
              <span className="text-xs">Generating release notes...</span>
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-xs text-jira-gray-500">
              No issues or details found for this release version.
            </div>
          ) : activeTab === "markdown" ? (
            /* Raw Markdown Textarea */
            <div className="relative">
              <textarea
                readOnly
                value={data.markdown}
                className="w-full h-[450px] font-mono text-xs p-4 bg-jira-gray-50 border border-jira-gray-300 rounded-md resize-none leading-relaxed text-jira-navy select-all"
              />
            </div>
          ) : (
            /* Rich Formatted Preview */
            <div className="space-y-6 max-w-2xl mx-auto">
              {/* Release Header Card */}
              <div className="p-4 bg-jira-blue-subtle/30 border border-jira-blue/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-jira-navy flex items-center gap-2">
                    <span>Release {version.name}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-jira-blue text-white">
                      {version.status}
                    </span>
                  </h3>
                  <span className="text-xs text-jira-gray-600 font-medium">
                    {version.releaseDate
                      ? calendarDateToLocal(version.releaseDate)?.toLocaleDateString()
                      : "Pending"}
                  </span>
                </div>
                {version.description && (
                  <p className="text-xs text-jira-gray-700 mt-2 italic">
                    &ldquo;{version.description}&rdquo;
                  </p>
                )}
              </div>

              {/* Features & Enhancements */}
              {data.features.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-jira-gray-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Features & Enhancements ({data.features.length})
                  </h4>
                  <ul className="divide-y divide-jira-gray-200 border border-jira-gray-200 rounded-lg overflow-hidden bg-white text-xs">
                    {data.features.map((issue) => (
                      <li key={issue.id} className="p-3 flex items-start justify-between gap-3 hover:bg-jira-gray-50">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-jira-blue">{issue.key}</span>
                            <span className="font-semibold text-jira-navy">{issue.title}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {issue.storyPoints !== null && (
                            <span className="px-1.5 py-0.5 rounded bg-jira-gray-100 font-bold text-[10px] text-jira-gray-600">
                              {issue.storyPoints} pts
                            </span>
                          )}
                          {issue.assignee && (
                            <span className="text-jira-gray-500 text-[11px]">
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-jira-gray-700 flex items-center gap-1.5">
                    <Bug className="w-4 h-4 text-jira-red" />
                    Bug Fixes ({data.bugs.length})
                  </h4>
                  <ul className="divide-y divide-jira-gray-200 border border-jira-gray-200 rounded-lg overflow-hidden bg-white text-xs">
                    {data.bugs.map((issue) => (
                      <li key={issue.id} className="p-3 flex items-start justify-between gap-3 hover:bg-jira-gray-50">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-jira-blue">{issue.key}</span>
                          <span className="font-semibold text-jira-navy">{issue.title}</span>
                        </div>
                        {issue.assignee && (
                          <span className="text-jira-gray-500 text-[11px] shrink-0">
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-jira-gray-700 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-jira-gray-600" />
                    Technical Improvements & Subtasks ({data.technical.length})
                  </h4>
                  <ul className="divide-y divide-jira-gray-200 border border-jira-gray-200 rounded-lg overflow-hidden bg-white text-xs">
                    {data.technical.map((issue) => (
                      <li key={issue.id} className="p-3 flex items-start justify-between gap-3 hover:bg-jira-gray-50">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-jira-blue">{issue.key}</span>
                          <span className="font-semibold text-jira-navy">{issue.title}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contributors */}
              {data.contributors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-jira-gray-700 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-jira-blue" />
                    Contributors ({data.contributors.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {data.contributors.map((c, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1 bg-jira-gray-100 border border-jira-gray-300 rounded-full text-xs font-medium text-jira-navy flex items-center gap-1.5"
                      >
                        <div className="w-4 h-4 rounded-full bg-jira-blue text-white text-[9px] font-bold flex items-center justify-center">
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
        </div>

        {/* Modal Footer with Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-jira-gray-200 bg-jira-gray-50 shrink-0">
          <div className="text-xs text-jira-gray-500">
            {data && (
              <span>
                Total issues included:{" "}
                <strong>
                  {data.features.length + data.bugs.length + data.technical.length}
                </strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={!data}
              className="text-xs font-semibold px-3 py-1.5 rounded border border-jira-gray-300 bg-white hover:bg-jira-gray-100 text-jira-navy transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-jira-gray-600" />
              Download .md
            </button>

            <button
              onClick={handleCopy}
              disabled={!data}
              className="text-xs font-semibold px-3.5 py-1.5 rounded bg-jira-blue text-white hover:bg-jira-blue-hover transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Markdown
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
