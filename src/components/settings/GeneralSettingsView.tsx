"use client";

import React, { useState, useEffect } from "react";
import SsoSettingsTab from "./SsoSettingsTab";
import SystemInfoTab from "./SystemInfoTab";
import { ShieldCheck, Info, Package, GitCommit } from "lucide-react";
import { SystemInfo } from "@/lib/systemUtils";
import { getSystemInfo } from "@/lib/actions/system";

interface GeneralSettingsViewProps {
  initialSystemInfo?: SystemInfo | null;
}

export default function GeneralSettingsView({
  initialSystemInfo,
}: GeneralSettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"sso" | "info">("sso");
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(
    initialSystemInfo || null
  );

  useEffect(() => {
    if (!systemInfo) {
      getSystemInfo()
        .then((info) => setSystemInfo(info))
        .catch(() => {});
    }
  }, [systemInfo]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-jira-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-jira-navy tracking-tight">
              System Settings
            </h1>
            <p className="text-xs text-jira-gray-600 mt-1">
              Manage instance-wide security policies, identity providers, and system information.
            </p>
          </div>

          {/* Version & Build Pill */}
          {systemInfo && (
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              title="Click to view full system information"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-jira-gray-100 hover:bg-jira-gray-200/80 border border-jira-gray-200 rounded-lg text-xs cursor-pointer transition-colors shrink-0 shadow-2xs text-left"
            >
              <div className="flex items-center gap-1.5 font-bold text-jira-navy">
                <Package className="w-3.5 h-3.5 text-jira-blue" />
                <span>v{systemInfo.version}</span>
              </div>
              <span className="text-jira-gray-300">•</span>
              <div className="flex items-center gap-1 font-mono text-[11px] text-jira-gray-600 bg-white px-1.5 py-0.5 rounded border border-jira-gray-200">
                <GitCommit className="w-3 h-3 text-jira-gray-400" />
                <span>build {systemInfo.commitHash}</span>
              </div>
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-6 mt-5 border-b border-jira-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab("sso")}
            className={`pb-2.5 text-xs font-semibold tracking-wide border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "sso"
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-600 hover:text-jira-navy"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Single Sign-On (SSO)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={`pb-2.5 text-xs font-semibold tracking-wide border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "info"
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-600 hover:text-jira-navy"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            System Info
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div>
        {activeTab === "sso" && <SsoSettingsTab />}
        {activeTab === "info" && systemInfo && (
          <SystemInfoTab systemInfo={systemInfo} />
        )}
      </div>
    </div>
  );
}
