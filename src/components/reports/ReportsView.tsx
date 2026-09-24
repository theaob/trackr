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
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Select } from "@/components/ui/Select";
import { Headline, Segmented } from "./kit";

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
  const [activeTab, setActiveTab] = useState<ReportTab>(isKanban ? "cfd" : "overview");

  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(initialSprintId);
  const [report, setReport] = useState<SprintReport>(initialReport);
  const [sprintLoading, setSprintLoading] = useState(false);

  const [cfdData, setCfdData] = useState<CFDResult | null>(initialCfd);
  const [cfdDays, setCfdDays] = useState(30);
  const [cfdLoading, setCfdLoading] = useState(false);

  const [distributionData, setDistributionData] = useState<ProjectDistributionReport | null>(initialDistribution);
  const [distributionScope, setDistributionScope] = useState<"sprint" | "project">(isKanban ? "project" : "sprint");
  const [distributionLoading, setDistributionLoading] = useState(false);

  const [epics, setEpics] = useState<EpicProgressItem[]>(initialEpics);
  const [epicsLoading, setEpicsLoading] = useState(false);

  // A different sprint loads its own report.
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

  // Cumulative flow loads when opened, and again for another time window.
  useEffect(() => {
    if (activeTab !== "cfd") return;
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

  useEffect(() => {
    if (activeTab !== "distribution") return;
    let cancelled = false;
    setDistributionLoading(true);
    getProjectDistribution(project.id, distributionScope === "sprint" ? selectedSprintId : null).then((res) => {
      if (!cancelled) {
        setDistributionData(res);
        setDistributionLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, distributionScope, selectedSprintId, project.id]);

  useEffect(() => {
    if (activeTab !== "epics" || epics.length > 0) return;
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

  const completionPct = report && report.totalPoints > 0 ? Math.round((report.completedPoints / report.totalPoints) * 100) : 0;
  const unit = report?.isIssueCount ? "issues" : "pts";
  const dateRange =
    report?.sprint.startDate && report?.sprint.endDate
      ? `${format(new Date(report.sprint.startDate), "MMM d")} – ${format(new Date(report.sprint.endDate), "MMM d, yyyy")}`
      : "No dates set";
  const sprintPicker = !isKanban && sprints.length > 0;

  const tabs: { id: ReportTab; label: string }[] = [
    ...(!isKanban
      ? [
          { id: "overview" as const, label: "Overview" },
          { id: "burndown" as const, label: "Burndown" },
          { id: "velocity" as const, label: "Velocity" },
        ]
      : []),
    { id: "cfd", label: "Cumulative flow" },
    { id: "distribution", label: "Distribution" },
    { id: "epics", label: "Epic progress" },
  ];

  const noSprint = (
    <p className="rounded-card border border-subtle bg-surface p-8 text-center text-xs text-muted">No sprint to report on yet.</p>
  );

  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-3 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Reports</h1>
          <p className="mt-0.5 text-xs text-muted">
            {project.name} · {isKanban ? "Kanban" : "Scrum"}
          </p>
        </div>
        {sprintPicker && (
          <div className="flex items-center gap-2">
            {sprintLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" aria-label="Loading the sprint" />}
            <Select
              aria-label="Sprint"
              className="w-56"
              value={selectedSprintId}
              onChange={setSelectedSprintId}
              options={sprints.map((s) => ({
                value: s.id,
                label: s.name,
                description: s.status === "ACTIVE" ? "Active" : "Completed",
              }))}
            />
          </div>
        )}
      </header>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportTab)}>
        <TabsList aria-label="Reports">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {!isKanban && (
          <TabsContent value="overview" className="space-y-5">
            {report ? (
              <>
                <section aria-label="This sprint" className="rounded-card border border-subtle bg-surface p-4 sm:p-5">
                  <Headline
                    label={`${report.sprint.name ?? "Sprint"} complete`}
                    value={`${completionPct}%`}
                    detail={`${report.sprint.status === "ACTIVE" ? "In progress" : "Completed"} · ${dateRange}`}
                    figures={[
                      { label: "Done", value: report.completedPoints, unit: `of ${report.totalPoints} ${unit}` },
                      { label: "Issues done", value: report.completedIssues, unit: `of ${report.totalIssues}` },
                    ]}
                  />
                </section>
                <BurndownChart
                  points={report.burndown}
                  totalPoints={report.totalPoints}
                  totalIssues={report.totalIssues}
                  unit={report.isIssueCount ? "issues" : "pts"}
                />
              </>
            ) : (
              noSprint
            )}
            <VelocityChart sprints={velocity} />
          </TabsContent>
        )}

        {!isKanban && (
          <TabsContent value="burndown">
            {report ? (
              <BurndownChart
                points={report.burndown}
                totalPoints={report.totalPoints}
                totalIssues={report.totalIssues}
                unit={report.isIssueCount ? "issues" : "pts"}
              />
            ) : (
              noSprint
            )}
          </TabsContent>
        )}

        {!isKanban && (
          <TabsContent value="velocity">
            <VelocityChart sprints={velocity} />
          </TabsContent>
        )}

        <TabsContent value="cfd">
          <CumulativeFlowChart initialData={cfdData} selectedDays={cfdDays} onTimeframeChange={setCfdDays} isLoading={cfdLoading} />
        </TabsContent>

        <TabsContent value="distribution">
          <DistributionChart
            data={distributionData}
            isLoading={distributionLoading}
            scopeControl={
              sprintPicker ? (
                <Segmented
                  label="Scope"
                  value={distributionScope}
                  onChange={setDistributionScope}
                  options={[
                    { value: "sprint", label: "This sprint" },
                    { value: "project", label: "Whole project" },
                  ]}
                />
              ) : undefined
            }
          />
        </TabsContent>

        <TabsContent value="epics">
          {epicsLoading && epics.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Loading epics…
            </p>
          ) : (
            <EpicProgressChart epics={epics} projectKey={project.key} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
