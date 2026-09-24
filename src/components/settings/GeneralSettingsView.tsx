"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import SsoSettingsTab from "./SsoSettingsTab";
import SystemInfoTab from "./SystemInfoTab";
import UsersSettingsTab from "./UsersSettingsTab";
import { ShieldCheck, Package, GitCommit, FolderGit2 } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { SystemInfo } from "@/lib/systemUtils";
import { getSystemInfo } from "@/lib/actions/system";

type SystemSection = "users" | "sso" | "info";
const SECTIONS: { id: SystemSection; label: string; description: string }[] = [
  { id: "users", label: "Users", description: "Everyone with an account, and who administers this install." },
  { id: "sso", label: "Single sign-on", description: "Let people sign in with your identity provider." },
  { id: "info", label: "About this install", description: "Version, build and where the data lives." },
];

interface GeneralSettingsViewProps {
  initialSystemInfo?: SystemInfo | null;
}

export default function GeneralSettingsView({
  initialSystemInfo,
}: GeneralSettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SystemSection>("users");
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
    <>
      {/* Mobile Notice: System Administration is desktop-only */}
      <div className="md:hidden flex flex-col items-center justify-center py-12 px-4 text-center bg-surface rounded-lg border border-subtle">
        <div className="w-14 h-14 rounded-2xl bg-warning-soft border border-subtle flex items-center justify-center text-warning shadow-2xs mb-4">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-base font-bold text-ink mb-1.5">
          Desktop Only Feature
        </h2>
        <p className="text-xs text-ink-2 max-w-sm mb-6 leading-relaxed">
          System administration, SSO/OIDC configuration, and user permissions are optimized for desktop displays.
        </p>
        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          <Link prefetch={false}
            href="/projects"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-accent-fg rounded-md text-xs font-semibold shadow-xs transition-colors"
          >
            <FolderGit2 className="w-4 h-4" />
            <span>Back to Projects</span>
          </Link>
        </div>
      </div>

      {/* Desktop Settings Layout */}
      <div className="hidden md:block space-y-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-ink">System settings</h1>
            <p className="mt-0.5 text-xs text-muted">People, sign-in and this install, for every project.</p>
          </div>
          {systemInfo && (
            <p className="flex items-center gap-2 text-xs text-ink-2">
              <Package className="h-3.5 w-3.5 text-muted" aria-hidden="true" />v{systemInfo.version}
              <span className="flex items-center gap-1 font-mono text-[11px] text-muted">
                <GitCommit className="h-3 w-3" aria-hidden="true" />
                {systemInfo.commitHash}
              </span>
            </p>
          )}
        </header>

        <div className="grid grid-cols-[12rem_minmax(0,1fr)] gap-8">
          <nav aria-label="System settings">
            <ul className="space-y-0.5">
              {SECTIONS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={activeTab === item.id ? "page" : undefined}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex h-8 w-full items-center rounded-control px-2.5 text-left text-[13px] transition-colors",
                      activeTab === item.id ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-surface-sunk hover:text-ink"
                    )}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="min-w-0 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-ink">{SECTIONS.find((x) => x.id === activeTab)!.label}</h2>
              <p className="mt-0.5 text-xs text-muted">{SECTIONS.find((x) => x.id === activeTab)!.description}</p>
            </div>
            {activeTab === "sso" && <SsoSettingsTab />}
            {activeTab === "users" && <UsersSettingsTab />}
            {activeTab === "info" && systemInfo && <SystemInfoTab systemInfo={systemInfo} />}
          </div>
        </div>
      </div>
    </>
  );
}
