"use client";

import React, { useState } from "react";
import SsoSettingsTab from "./SsoSettingsTab";
import { ShieldCheck } from "lucide-react";

export default function GeneralSettingsView() {
  const [activeTab, setActiveTab] = useState<"sso">("sso");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-jira-gray-200">
        <h1 className="text-xl font-bold text-jira-navy tracking-tight">System Settings</h1>
        <p className="text-xs text-jira-gray-600 mt-1">
          Manage instance-wide security policies, identity providers, and authentication configuration.
        </p>

        {/* Tab Navigation */}
        <div className="flex items-center gap-6 mt-4 border-b border-jira-gray-200">
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
        </div>
      </div>

      {/* Content Area */}
      <div>
        {activeTab === "sso" && <SsoSettingsTab />}
      </div>
    </div>
  );
}
