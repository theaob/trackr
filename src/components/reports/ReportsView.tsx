"use client";

import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { Project } from "@/types";
import {
  getSprintReport,
  getCumulativeFlowReport,
  getProjectDistribution,
  getEpicProgressReport,
  VelocitySprintItem,
  ProjectDistributionReport,
  EpicProgressItem,
} from "@/lib/actions/reports";
import type { CFDResult } from "@/lib/cfd";
import BurndownChart from "./BurndownChart";
import VelocityChart from "./VelocityChart";
import CumulativeFlowChart from "./CumulativeFlowChart";
import DistributionChart from "./DistributionChart";
import EpicProgressChart from "./EpicProgressChart";
import {
  BarChart3,
  Loader2,
  Target,
  CheckCircle2,
  ListChecks,
  CalendarRange,
  TrendingDown,
  Gauge,
  Layers,
  PieChart,
  GitMerge,
  LayoutDashboard,
} from "lucide-react";

interface ReportableSprint {
  id: string;
  name: string;
  status: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
}

type SprintReport = Awaited<ReturnType<typeof getSprintReport>>;

interface ReportsViewProps {
  project: Project;
  sprints: ReportableSprint[];
  initialSprintId: string | null;
  initialReport: SprintReport;
  velocity: VelocitySprintItem[] | any[];
  initialCfd?: CFDResult | null;
  initialDistribution?: ProjectDistributionReport | null;
  initialEpics?: EpicProgressItem[];
}

type ReportTab = "overview" | "burndown" | "velocity" | "cfd" | "distribution" | "epics";

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
        <div className="text-[11px] font-semibold text-jira-gray-600 uppercase tracking-wide">
          {label}
        </div>
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
  initialCfd = null,
  initialDistribution = null,
  initialEpics = [],
}: ReportsViewProps) {
  const isKanban = project.boardType === "KANBAN";

  // Tab State: Kanban defaults to Cumulative Flow (CFD)
  const [activeTab, setActiveTab] = useState<ReportTab>(isKanban ? "cfd" : "overview");

  // Sprint Data
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(initialSprintId);
  const [report, setReport] = useState<SprintReport>(initialReport);
  const [sprintLoading, setSprintLoading] = useState(false);

  // CFD Data
  const [cfdData, setCfdData] = useState<CFDResult | null>(initialCfd);
  const [cfdDays, setCfdDays] = useState(30);
  const [cfdLoading, setCfdLoading] = useState(false);

  // Distribution Data
  const [distributionData, setDistributionData] = useState<ProjectDistributionReport | null>(
    initialDistribution
  );
  const [distributionScope, setDistributionScope] = useState<"sprint" | "project">(
    isKanban ? "project" : "sprint"
  );
  const [distributionLoading, setDistributionLoading] = useState(false);

  // Epic Progress Data
  const [epics, setEpics] = useState<EpicProgressItem[]>(initialEpics);
  const [epicsLoading, setEpicsLoading] = useState(false);

  // Fetch Sprint Report when sprint selector changes
  useEffect(() => {
    if (!selectedSprintId || selectedSprintId === initialSprintId) return;
    let cancelled = false;
    setSprintLoading(true);
    getSprintReport(selectedSprintId).then((res) => {
      if (!cancelled) {
        setReport(res);
        setSprintLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedSprintId, initialSprintId]);

  // Lazy-load CFD on timeframe change or when tab opened without data
  useEffect(() => {
    if (activeTab !== "cfd" && activeTab !== "overview") return;
    if (cfdData && cfdDays === 30) return;

    let cancelled = false;
    setCfdLoading(true);
    getCumulativeFlowReport(project.id, cfdDays).then((res) => {
      if (!cancelled) {
        setCfdData(res);
        setCfdLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, cfdDays, project.id, cfdData]);

  // Lazy-load Distribution if not present or scope changes
  useEffect(() => {
    if (activeTab !== "distribution" && activeTab !== "overview") return;

    let cancelled = false;
    setDistributionLoading(true);
    const targetSprint = distributionScope === "sprint" ? selectedSprintId : null;
    getProjectDistribution(project.id, targetSprint).then((res) => {
      if (!cancelled) {
        setDistributionData(res);
        setDistributionLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, distributionScope, selectedSprintId, project.id]);

  // Lazy-load Epics if not present
  useEffect(() => {
    if (activeTab !== "epics" && activeTab !== "overview") return;
    if (epics.length > 0) return;

    let cancelled = false;
    setEpicsLoading(true);
    getEpicProgressReport(project.id).then((res) => {
      if (!cancelled) {
        setEpics(res);
        setEpicsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, project.id, epics.length]);

  const completionPct =
    report && report.totalPoints > 0
      ? Math.round((report.completedPoints / report.totalPoints) * 100)
      : 0;

  const dateRange =
    report?.sprint.startDate && report?.sprint.endDate
      ? `${format(new Date(report.sprint.startDate), "MMM d")} – ${format(
          new Date(report.sprint.endDate),
          "MMM d, yyyy"
        )}`
      : "No dates set";

  // Tab definitions
  const tabs = [
    ...(!isKanban
      ? [
          { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
          { id: "burndown" as const, label: "Burndown & Burnup", icon: TrendingDown },
          { id: "velocity" as const, label: "Velocity", icon: Gauge },
        ]
      : []),
    { id: "cfd" as const, label: "Cumulative Flow (CFD)", icon: Layers },
    { id: "distribution" as const, label: "Workload & Distribution", icon: PieChart },
    { id: "epics" as const, label: "Epic Progress", icon: GitMerge },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header & Main Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-jira-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-jira-navy">Reports & Analytics</h1>
            <span className="text-xs px-2 py-0.5 rounded font-semibold bg-jira-gray-200 text-jira-gray-700">
              {isKanban ? "Kanban" : "Scrum"}
            </span>
          </div>
          <p className="text-xs text-jira-gray-500 mt-0.5">{project.name}</p>
        </div>

        {/* Sprint Selector (visible on Scrum for sprint-dependent tabs) */}
        {!isKanban && sprints.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-jira-gray-500">Sprint:</span>
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
        )}
      </div>

      {/* Reports Hub Navigation Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-jira-gray-200 overflow-x-auto no-scrollbar pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 text-xs font-semibold rounded-t-md border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? "border-jira-blue text-jira-blue bg-jira-blue/5"
                  : "border-transparent text-jira-gray-600 hover:text-jira-navy hover:bg-jira-gray-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Loading state indicator */}
      {sprintLoading && (
        <div className="flex items-center gap-2 text-xs text-jira-gray-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-jira-blue" />
          Updating sprint data...
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {report && (
            <>
              {/* Stat tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
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
                <StatTile
                  icon={ListChecks}
                  label="Issues"
                  value={`${report.completedIssues}/${report.totalIssues}`}
                  sublabel="completed"
                />
                <StatTile
                  icon={CalendarRange}
                  label="Sprint Status"
                  value={report.sprint.status === "ACTIVE" ? "In Progress" : "Completed"}
                  sublabel={dateRange}
                />
              </div>

              {/* Burndown / Burnup Quick Card */}
              <div className="bg-white border border-jira-gray-200 rounded-lg p-3.5 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-bold text-jira-navy">Sprint Progress Timeline</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab("burndown")}
                    className="text-xs font-semibold text-jira-blue hover:underline"
                  >
                    View Full Chart &rarr;
                  </button>
                </div>
                <p className="text-[11px] text-jira-gray-500 mb-4">
                  Interactive sprint burndown and burnup tracking.
                </p>
                <BurndownChart
                  points={report.burndown}
                  totalPoints={report.totalPoints}
                  totalIssues={report.totalIssues}
                  unit={report.isIssueCount ? "issues" : "pts"}
                />
              </div>
            </>
          )}

          {/* Quick Velocity Card */}
          <div className="bg-white border border-jira-gray-200 rounded-lg p-3.5 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-jira-navy">Velocity (Committed vs. Completed)</h2>
              <button
                type="button"
                onClick={() => setActiveTab("velocity")}
                className="text-xs font-semibold text-jira-blue hover:underline"
              >
                View Full Velocity &rarr;
              </button>
            </div>
            <p className="text-[11px] text-jira-gray-500 mb-4">
              Story points committed vs completed across recent sprints.
            </p>
            <VelocityChart sprints={velocity} />
          </div>
        </div>
      )}

      {/* TAB 2: BURNDOWN & BURNUP */}
      {activeTab === "burndown" && (
        <div className="bg-white border border-jira-gray-200 rounded-lg p-3.5 sm:p-5 shadow-xs space-y-2">
          <div>
            <h2 className="text-base font-bold text-jira-navy">Sprint Burndown & Burnup</h2>
            <p className="text-xs text-jira-gray-500">
              Track work remaining against the ideal guideline or monitor completed work climbing toward total scope.
            </p>
          </div>

          {report ? (
            <BurndownChart
              points={report.burndown}
              totalPoints={report.totalPoints}
              totalIssues={report.totalIssues}
              unit={report.isIssueCount ? "issues" : "pts"}
            />
          ) : (
            <div className="p-8 text-center text-xs text-jira-gray-400">
              No sprint selected or data unavailable.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: VELOCITY */}
      {activeTab === "velocity" && (
        <div className="bg-white border border-jira-gray-200 rounded-lg p-3.5 sm:p-5 shadow-xs space-y-2">
          <div>
            <h2 className="text-base font-bold text-jira-navy">Velocity Chart</h2>
            <p className="text-xs text-jira-gray-500">
              Compare committed work at sprint start with delivered work at sprint end to gauge team predictability.
            </p>
          </div>
          <VelocityChart sprints={velocity} />
        </div>
      )}

      {/* TAB 4: CUMULATIVE FLOW (CFD) */}
      {activeTab === "cfd" && (
        <div className="bg-white border border-jira-gray-200 rounded-lg p-3.5 sm:p-5 shadow-xs space-y-2">
          <div>
            <h2 className="text-base font-bold text-jira-navy">Cumulative Flow Diagram (CFD)</h2>
            <p className="text-xs text-jira-gray-500">
              Visualize work in progress, identify workflow bottlenecks, and measure cycle and lead times.
            </p>
          </div>
          <CumulativeFlowChart
            initialData={cfdData}
            selectedDays={cfdDays}
            onTimeframeChange={(days) => setCfdDays(days)}
            isLoading={cfdLoading}
          />
        </div>
      )}

      {/* TAB 5: WORKLOAD & DISTRIBUTION */}
      {activeTab === "distribution" && (
        <div className="bg-white border border-jira-gray-200 rounded-lg p-3.5 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-jira-navy">Issue Workload & Distribution</h2>
              <p className="text-xs text-jira-gray-500">
                Explore the distribution of work across statuses, priorities, issue types, and team assignees.
              </p>
            </div>

            {!isKanban && sprints.length > 0 && (
              <div className="flex items-center gap-1 bg-jira-gray-100 p-0.5 rounded border border-jira-gray-200 text-xs">
                <button
                  type="button"
                  onClick={() => setDistributionScope("sprint")}
                  className={`px-3 py-1 rounded font-medium transition-all ${
                    distributionScope === "sprint"
                      ? "bg-white text-jira-navy shadow-2xs font-semibold"
                      : "text-jira-gray-600 hover:text-jira-navy"
                  }`}
                >
                  Selected Sprint
                </button>
                <button
                  type="button"
                  onClick={() => setDistributionScope("project")}
                  className={`px-3 py-1 rounded font-medium transition-all ${
                    distributionScope === "project"
                      ? "bg-white text-jira-navy shadow-2xs font-semibold"
                      : "text-jira-gray-600 hover:text-jira-navy"
                  }`}
                >
                  Entire Project
                </button>
              </div>
            )}
          </div>

          <DistributionChart data={distributionData} isLoading={distributionLoading} />
        </div>
      )}

      {/* TAB 6: EPIC PROGRESS */}
      {activeTab === "epics" && (
        <div className="bg-white border border-jira-gray-200 rounded-lg p-3.5 sm:p-5 shadow-xs space-y-2">
          <div>
            <h2 className="text-base font-bold text-jira-navy">Epic Progress Report</h2>
            <p className="text-xs text-jira-gray-500">
              Track overall progress, completion percentages, and child issue status across all project epics.
            </p>
          </div>
          <EpicProgressChart epics={epics} projectKey={project.key} />
        </div>
      )}
    </div>
  );
}
