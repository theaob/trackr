"use client";

import React, { useState } from "react";
import { SystemInfo, formatPlatform, formatUptime } from "@/lib/systemUtils";
import {
  Package,
  GitCommit,
  Server,
  Database,
  Layers,
  Clock,
  Cpu,
  CheckCircle2,
  Copy,
  Check,
  FolderKanban,
  FileText,
  Users,
  Activity,
} from "lucide-react";

interface SystemInfoTabProps {
  systemInfo: SystemInfo;
}

export default function SystemInfoTab({ systemInfo }: SystemInfoTabProps) {
  const [copiedCommit, setCopiedCommit] = useState(false);

  const handleCopyCommit = () => {
    navigator.clipboard.writeText(systemInfo.commitHash);
    setCopiedCommit(true);
    setTimeout(() => setCopiedCommit(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Version Badge Card */}
        <div className="bg-white rounded-lg border border-jira-gray-200 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-jira-blue-light/50 flex items-center justify-center text-jira-blue shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-jira-gray-600 uppercase tracking-wider">
                Version
              </div>
              <div className="text-lg font-bold text-jira-navy mt-0.5">
                v{systemInfo.version}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-jira-gray-100 flex items-center justify-between text-xs text-jira-gray-600">
            <span>Release</span>
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Stable
            </span>
          </div>
        </div>

        {/* Build & Git Commit Card */}
        <div className="bg-white rounded-lg border border-jira-gray-200 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <GitCommit className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-jira-gray-600 uppercase tracking-wider">
                Build Revision
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-sm font-bold text-jira-navy bg-jira-gray-100 px-2 py-0.5 rounded border border-jira-gray-200">
                  {systemInfo.commitHash}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCommit}
                  title="Copy commit hash"
                  className="p-1 text-jira-gray-400 hover:text-jira-navy hover:bg-jira-gray-100 rounded transition-colors"
                >
                  {copiedCommit ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-jira-gray-100 flex items-center justify-between text-xs text-jira-gray-600">
            <span>Environment</span>
            <span className="capitalize font-semibold text-jira-navy text-[11px]">
              {systemInfo.environment}
            </span>
          </div>
        </div>

        {/* Server Uptime Card */}
        <div className="bg-white rounded-lg border border-jira-gray-200 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-jira-gray-600 uppercase tracking-wider">
                Server Uptime
              </div>
              <div className="text-lg font-bold text-jira-navy mt-0.5">
                {formatUptime(systemInfo.uptimeSeconds)}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-jira-gray-100 flex items-center justify-between text-xs text-jira-gray-600">
            <span>Status</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Operational
            </span>
          </div>
        </div>
      </div>

      {/* Details Table: Environment & Runtime Details */}
      <div className="bg-white rounded-lg border border-jira-gray-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-jira-gray-50 border-b border-jira-gray-200 flex items-center gap-2">
          <Server className="w-4 h-4 text-jira-gray-600" />
          <h2 className="text-xs font-bold text-jira-navy uppercase tracking-wider">
            Environment & Runtime
          </h2>
        </div>

        <div className="divide-y divide-jira-gray-100 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3 items-center">
            <div className="font-semibold text-jira-gray-600 flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-jira-gray-400" />
              Application Name
            </div>
            <div className="sm:col-span-2 font-medium text-jira-navy">Trackr</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3 items-center">
            <div className="font-semibold text-jira-gray-600 flex items-center gap-2">
              <GitCommit className="w-3.5 h-3.5 text-jira-gray-400" />
              Application Version & Build
            </div>
            <div className="sm:col-span-2 font-medium text-jira-navy flex items-center gap-2">
              <span className="font-bold">v{systemInfo.version}</span>
              <span className="text-jira-gray-400">•</span>
              <span className="font-mono text-[11px] bg-jira-gray-100 px-2 py-0.5 rounded border border-jira-gray-200">
                build {systemInfo.commitHash}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3 items-center">
            <div className="font-semibold text-jira-gray-600 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-jira-gray-400" />
              Framework
            </div>
            <div className="sm:col-span-2 font-medium text-jira-navy">
              Next.js {systemInfo.nextVersion} (React 18)
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3 items-center">
            <div className="font-semibold text-jira-gray-600 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-jira-gray-400" />
              Node.js Runtime
            </div>
            <div className="sm:col-span-2 font-medium text-jira-navy">
              {systemInfo.nodeVersion}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3 items-center">
            <div className="font-semibold text-jira-gray-600 flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-jira-gray-400" />
              Operating System
            </div>
            <div className="sm:col-span-2 font-medium text-jira-navy">
              {formatPlatform(systemInfo.platform, systemInfo.arch)}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3 items-center">
            <div className="font-semibold text-jira-gray-600 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-jira-gray-400" />
              Database Provider
            </div>
            <div className="sm:col-span-2 font-medium text-jira-navy flex items-center gap-2">
              <span>{systemInfo.databaseProvider}</span>
              <span className="text-jira-gray-400">•</span>
              <span className="text-jira-gray-600">Prisma ORM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Instance Summary Statistics */}
      <div className="bg-white rounded-lg border border-jira-gray-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-jira-gray-50 border-b border-jira-gray-200 flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-jira-gray-600" />
          <h2 className="text-xs font-bold text-jira-navy uppercase tracking-wider">
            Instance Data
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-jira-gray-100 p-4">
          <div className="flex items-center gap-3 p-3">
            <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-jira-gray-600 uppercase">
                Projects
              </div>
              <div className="text-base font-bold text-jira-navy">
                {systemInfo.totalProjects}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-jira-gray-600 uppercase">
                Total Issues
              </div>
              <div className="text-base font-bold text-jira-navy">
                {systemInfo.totalIssues.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-jira-gray-600 uppercase">
                Users
              </div>
              <div className="text-base font-bold text-jira-navy">
                {systemInfo.totalUsers}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
