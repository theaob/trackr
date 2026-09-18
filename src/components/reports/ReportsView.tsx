"use client";

import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { Project } from "@/types";
import { getSprintReport } from "@/lib/actions/reports";
import BurndownChart from "./BurndownChart";
import VelocityChart from "./VelocityChart";
import StatusBreakdownChart from "./StatusBreakdownChart";
import { BarChart3, Loader2, Target, CheckCircle2, ListChecks, CalendarRange } from "lucide-react";

interface ReportableSprint {
  id: string;
  name: string;
  status: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
}

interface VelocitySprint {
  id: string;
  name: string;
  points: number;
  issueCount: number;
}

type SprintReport = Awaited<ReturnType<typeof getSprintReport>>;

interface ReportsViewProps {
  project: Project;
  sprints: ReportableSprint[];
  initialSprintId: string | null;
  initialReport: SprintReport;
  velocity: VelocitySprint[];
}

function StatTile({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="bg-white border border-jira-gray-200 rounded-lg p-4 flex items-start gap-3 shadow-xs">
      <div className="w-9 h-9 rounded-md bg-jira-blue-light/60 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-jira-blue" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-jira-gray-600 uppercase tracking-wide">{label}</div>
        <div className="text-xl font-bold text-jira-navy leading-tight">{value}</div>
        {sublabel && <div className="text-[11px] text-jira-gray-500 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}

export default function ReportsView({
  project,
  sprints,
  initialSprintId,
  initialReport,
  velocity,
}: ReportsViewProps) {
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(initialSprintId);
  const [report, setReport] = useState<SprintReport>(initialReport);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedSprintId || selectedSprintId === initialSprintId) return;
    let cancelled = false;
    setLoading(true);
    getSprintReport(selectedSprintId).then((res) => {
      if (!cancelled) {
        setReport(res);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedSprintId, initialSprintId]);

  if (sprints.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <BarChart3 className="w-10 h-10 text-jira-gray-300" />
        <h2 className="text-sm font-bold text-jira-navy">No reports yet</h2>
        <p className="text-xs text-jira-gray-500 max-w-sm">
          {project.boardType === "KANBAN"
            ? "Burndown and velocity are sprint-based reports, and this is a Kanban project with no sprints. Switch to Scrum in Project Settings to start one."
            : `Start a sprint from the Backlog to begin tracking burndown and velocity for ${project.name}.`}
        </p>
      </div>
    );
  }

  const completionPct = report && report.totalPoints > 0
    ? Math.round((report.completedPoints / report.totalPoints) * 100)
    : 0;

  const dateRange = report?.sprint.startDate && report?.sprint.endDate
    ? `${format(new Date(report.sprint.startDate), "MMM d")} – ${format(new Date(report.sprint.endDate), "MMM d, yyyy")}`
    : "No dates set";

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-jira-navy">Reports</h1>
          <p className="text-xs text-jira-gray-500 mt-0.5">{project.name}</p>
        </div>

        <select
          value={selectedSprintId ?? ""}
          onChange={(e) => setSelectedSprintId(e.target.value)}
          className="bg-white border border-jira-gray-300 rounded-md px-3 py-1.5 text-xs font-semibold text-jira-navy outline-none focus:border-jira-blue"
        >
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.status === "ACTIVE" ? "(Active)" : "(Completed)"}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-jira-gray-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading sprint report...
        </div>
      )}

      {report && (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              icon={Target}
              label={report.isIssueCount ? "Issues Count" : "Story Points"}
              value={`${report.totalPoints}`}
              sublabel={`${report.completedPoints} completed`}
            />
            <StatTile
              icon={CheckCircle2}
              label="Completion"
              value={`${completionPct}%`}
              sublabel={report.isIssueCount ? "of total issues" : "of committed points"}
            />
            <StatTile icon={ListChecks} label="Issues" value={`${report.completedIssues}/${report.totalIssues}`} sublabel="completed" />
            <StatTile
              icon={CalendarRange}
              label="Sprint Status"
              value={report.sprint.status === "ACTIVE" ? "In Progress" : "Completed"}
              sublabel={dateRange}
            />
          </div>

          {/* Burndown */}
          <div className="bg-white border border-jira-gray-200 rounded-lg p-5 shadow-xs">
            <h2 className="text-sm font-bold text-jira-navy mb-1">Sprint Burndown</h2>
            <p className="text-[11px] text-jira-gray-500 mb-4">
              {report.isIssueCount
                ? "Issues remaining vs. an ideal, straight-line guideline to zero."
                : "Story points remaining vs. an ideal, straight-line guideline to zero."}
            </p>
            <BurndownChart
              points={report.burndown}
              totalPoints={report.totalPoints}
              unit={report.isIssueCount ? "issues" : "pts"}
            />
          </div>

          {/* Status breakdown */}
          <div className="bg-white border border-jira-gray-200 rounded-lg p-5 shadow-xs">
            <h2 className="text-sm font-bold text-jira-navy mb-1">Status Breakdown</h2>
            <p className="text-[11px] text-jira-gray-500 mb-4">
              Where this sprint&rsquo;s issues currently stand.
            </p>
            <StatusBreakdownChart breakdown={report.statusBreakdown} />
          </div>
        </>
      )}

      {/* Velocity (project-wide, independent of the sprint selector) */}
      <div className="bg-white border border-jira-gray-200 rounded-lg p-5 shadow-xs">
        <h2 className="text-sm font-bold text-jira-navy mb-1">Velocity</h2>
        <p className="text-[11px] text-jira-gray-500 mb-4">
          Story points completed in each of the last {velocity.length || 0} finished sprints.
        </p>
        <VelocityChart sprints={velocity} />
      </div>
    </div>
  );
}
