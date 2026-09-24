"use client";

import React, { useMemo, useState } from "react";
import { Loader2, PieChart } from "lucide-react";
import type { ProjectDistributionReport } from "@/lib/actions/reports";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import UserAvatar from "@/components/common/UserAvatar";
import { IssueTypeIcon, PriorityIcon } from "@/components/common/IssueIcons";
import type { IssueType, PriorityLevel } from "@/types";
import { DataTable, EmptyChart, Headline, ReportCard, Segmented, series, type Unit } from "./kit";

interface DistributionChartProps {
  data: ProjectDistributionReport | null;
  isLoading?: boolean;
  /** The sprint/project switch, when the page offers one. */
  scopeControl?: React.ReactNode;
}

type Dimension = "status" | "priority" | "type" | "assignee";
const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "type", label: "Type" },
  { value: "priority", label: "Priority" },
];
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

interface Row {
  key: string;
  label: string;
  icon: React.ReactNode;
  value: number;
}

/**
 * Where the work sits: by status, assignee, type or priority, as one bar per
 * value. It leads with the total and the largest share.
 */
export default function DistributionChart({ data, isLoading = false, scopeControl }: DistributionChartProps) {
  const [dimension, setDimension] = useState<Dimension>("status");
  const [metric, setMetric] = useState<Unit>("issues");
  const issues = metric === "issues";
  const u = issues ? "issues" : "pts";

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const pick = (e: { count: number; points: number }) => (issues ? e.count : e.points);
    const dot = (color: string) => (
      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
    );
    const list: Row[] =
      dimension === "assignee"
        ? data.byAssignee.map((a) => ({
            key: a.id,
            label: a.name,
            icon:
              a.id === "unassigned" ? (
                <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border border-dashed border-strong" />
              ) : (
                <UserAvatar user={{ id: a.id, name: a.name, avatarUrl: a.avatarUrl } as never} size="xs" />
              ),
            value: pick(a),
          }))
        : dimension === "status"
          ? data.byStatus.map((e) => ({ key: e.name, label: prettifyStatusName(e.name), icon: dot(e.color), value: pick(e) }))
          : dimension === "type"
            ? data.byType.map((e) => ({
                key: e.name,
                label: titleCase(e.name),
                icon: <IssueTypeIcon type={e.name as IssueType} className="h-4 w-4" />,
                value: pick(e),
              }))
            : data.byPriority.map((e) => ({
                key: e.name,
                label: titleCase(e.name),
                icon: <PriorityIcon priority={e.name as PriorityLevel} className="h-4 w-4" />,
                value: pick(e),
              }));
    return list.filter((r) => r.value > 0);
  }, [data, dimension, issues]);

  const total = rows.reduce((a, r) => a + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const largest = rows.reduce<Row | null>((best, r) => (!best || r.value > best.value ? r : best), null);
  const share = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const dimensionName = DIMENSIONS.find((d) => d.value === dimension)!.label.toLowerCase();

  const chart =
    !data || total === 0 ? (
      <EmptyChart icon={<PieChart aria-hidden="true" />}>No issues to show here.</EmptyChart>
    ) : (
      <ul aria-label={`${u === "issues" ? "Issues" : "Story points"} by ${dimensionName}`} className="space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.key}
            className="grid grid-cols-[minmax(0,10rem)_1fr_5.5rem] items-center gap-3 text-xs sm:grid-cols-[minmax(0,12rem)_1fr_6rem]"
          >
            <span className="flex min-w-0 items-center gap-2 text-ink">
              {r.icon}
              <span className="truncate">{r.label}</span>
            </span>
            <span aria-hidden="true" className="h-4 rounded-[2px] bg-surface-sunk">
              <span className="block h-full rounded-r-[4px]" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: series(1) }} />
            </span>
            <span className="text-right tabular-nums text-ink-2">
              <span className="font-medium text-ink">{r.value}</span> · {share(r.value)}%
            </span>
          </li>
        ))}
      </ul>
    );

  return (
    <ReportCard
      title="Distribution"
      description="How the work splits by status, assignee, type or priority."
      headline={
        total > 0 ? (
          <Headline
            label={issues ? "Issues" : "Story points"}
            value={total}
            detail={largest ? `Largest share: ${largest.label}, ${share(largest.value)}%` : undefined}
          />
        ) : undefined
      }
      legend={
        isLoading ? (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Updating…
          </p>
        ) : (
          <span />
        )
      }
      controls={
        <>
          {scopeControl}
          <Segmented label="Group by" value={dimension} onChange={setDimension} options={DIMENSIONS} />
          <Segmented
            label="Unit"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "issues", label: "Issues" },
              { value: "points", label: "Story points" },
            ]}
          />
        </>
      }
      chart={chart}
      table={
        <DataTable
          caption={`${issues ? "Issues" : "Story points"} by ${dimensionName}`}
          columns={[
            { label: DIMENSIONS.find((d) => d.value === dimension)!.label },
            { label: issues ? "Issues" : "Points", numeric: true },
            { label: "Share", numeric: true },
          ]}
          rows={rows.map((r) => ({ key: r.key, cells: [r.label, r.value, `${share(r.value)}%`] }))}
        />
      }
    />
  );
}
