"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Layers, Calendar, CheckCircle2, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import type { EpicProgressItem } from "@/lib/actions/reports";
import { PriorityIcon } from "@/components/common/IssueIcons";
import { PriorityLevel } from "@/types";

interface EpicProgressChartProps {
  epics: EpicProgressItem[];
  projectKey: string;
}

export default function EpicProgressChart({ epics, projectKey }: EpicProgressChartProps) {
  const [filter, setFilter] = useState<"ALL" | "IN_PROGRESS" | "DONE">("ALL");

  const filteredEpics = epics.filter((e) => {
    if (filter === "DONE") return e.completionPct === 100;
    if (filter === "IN_PROGRESS") return e.completionPct > 0 && e.completionPct < 100;
    return true;
  });

  if (epics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-jira-gray-400 gap-2">
        <Layers className="w-8 h-8" />
        <p className="text-xs">No Epics created in this project yet.</p>
      </div>
    );
  }

  const totalPoints = epics.reduce((sum, e) => sum + e.totalPoints, 0);
  const completedPoints = epics.reduce((sum, e) => sum + e.completedPoints, 0);
  const overallPct = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-jira-gray-200 pb-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-jira-gray-100 p-0.5 rounded border border-jira-gray-200 text-xs">
          {[
            { id: "ALL", label: `All (${epics.length})` },
            { id: "IN_PROGRESS", label: "In Progress" },
            { id: "DONE", label: "Completed" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1 rounded font-medium transition-all ${
                filter === tab.id
                  ? "bg-white text-jira-navy shadow-2xs font-semibold"
                  : "text-jira-gray-600 hover:text-jira-navy"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] text-jira-gray-600">
          <span className="flex items-center gap-1.5 font-medium text-emerald-700">
            <span className="w-3 h-3 rounded-xs bg-[#36B37E]" />
            Done
          </span>
          <span className="flex items-center gap-1.5 font-medium text-jira-blue">
            <span className="w-3 h-3 rounded-xs bg-[#0052CC]" />
            In Progress
          </span>
          <span className="flex items-center gap-1.5 font-medium text-jira-gray-600">
            <span className="w-3 h-3 rounded-xs bg-[#DFE1E6]" />
            To Do
          </span>
        </div>
      </div>

      {/* Overall Summary KPI */}
      <div className="bg-jira-gray-50 border border-jira-gray-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold text-jira-gray-500 uppercase">Overall Epic Completion</div>
          <div className="text-xl font-bold text-jira-navy mt-0.5">
            {completedPoints} of {totalPoints} story points ({overallPct}%)
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-jira-gray-600">
          <div>
            <span className="font-bold text-jira-navy">{epics.length}</span> Epics total
          </div>
          <div>
            <span className="font-bold text-emerald-600">
              {epics.filter((e) => e.completionPct === 100).length}
            </span>{" "}
            completed
          </div>
        </div>
      </div>

      {/* Epic Cards List */}
      <div className="space-y-3">
        {filteredEpics.map((epic) => {
          const donePct = epic.totalPoints > 0
            ? (epic.completedPoints / epic.totalPoints) * 100
            : epic.totalIssues > 0
            ? (epic.completedIssues / epic.totalIssues) * 100
            : 0;

          const inProgPct = epic.totalPoints > 0
            ? (epic.inProgressPoints / epic.totalPoints) * 100
            : epic.totalIssues > 0
            ? (epic.inProgressIssues / epic.totalIssues) * 100
            : 0;

          const todoPct = Math.max(0, 100 - donePct - inProgPct);

          const isOverdue = epic.dueDate && new Date(epic.dueDate) < new Date() && epic.completionPct < 100;

          return (
            <div
              key={epic.id}
              className="bg-white border border-jira-gray-200 rounded-lg p-4 hover:border-jira-blue transition-colors shadow-2xs space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
                    {epic.key}
                  </span>
                  <Link
                    href={`/projects/${projectKey}/issues?issue=${epic.key}`}
                    className="text-sm font-semibold text-jira-navy hover:text-jira-blue transition-colors truncate"
                  >
                    {epic.title}
                  </Link>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-xs">
                  {epic.dueDate && (
                    <span
                      className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded ${
                        isOverdue
                          ? "bg-red-50 text-red-600 border border-red-200"
                          : "text-jira-gray-500"
                      }`}
                    >
                      <Calendar className="w-3 h-3" />
                      {format(new Date(epic.dueDate), "MMM d, yyyy")}
                      {isOverdue && <span className="font-bold ml-0.5">(Overdue)</span>}
                    </span>
                  )}

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      epic.completionPct === 100
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-blue-50 text-jira-blue border border-blue-200"
                    }`}
                  >
                    {epic.completionPct}% Done
                  </span>
                </div>
              </div>

              {/* Stacked Progress Bar */}
              <div className="space-y-1">
                <div className="h-3 rounded-full overflow-hidden bg-jira-gray-200 flex">
                  {donePct > 0 && (
                    <div
                      style={{ width: `${donePct}%` }}
                      className="h-full bg-[#36B37E] transition-all"
                      title={`Completed: ${epic.completedPoints} pts (${epic.completedIssues} issues)`}
                    />
                  )}
                  {inProgPct > 0 && (
                    <div
                      style={{ width: `${inProgPct}%` }}
                      className="h-full bg-[#0052CC] transition-all"
                      title={`In Progress: ${epic.inProgressPoints} pts (${epic.inProgressIssues} issues)`}
                    />
                  )}
                  {todoPct > 0 && (
                    <div
                      style={{ width: `${todoPct}%` }}
                      className="h-full bg-[#DFE1E6] transition-all"
                      title={`To Do: ${epic.todoPoints} pts (${epic.todoIssues} issues)`}
                    />
                  )}
                </div>

                {/* Sub-bar numbers */}
                <div className="flex items-center justify-between text-[11px] text-jira-gray-500 font-mono pt-0.5">
                  <div>
                    {epic.completedPoints} of {epic.totalPoints} pts completed
                  </div>
                  <div>
                    {epic.completedIssues} of {epic.totalIssues} issues
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
