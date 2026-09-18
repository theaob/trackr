import React from "react";
import { getProjects } from "@/lib/actions/projects";
import { getSystemInfo } from "@/lib/actions/system";
import { requirePageUser, denyPageAccess } from "@/lib/auth/page";
import { requireAnyProjectAdmin } from "@/lib/auth/guards";
import Navbar from "@/components/layout/Navbar";
import GeneralSettingsView from "@/components/settings/GeneralSettingsView";
import { SearchProvider } from "@/context/SearchContext";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePageUser("/settings");
  try {
    await requireAnyProjectAdmin();
  } catch {
    return denyPageAccess("/settings");
  }

  const [allProjects, systemInfo] = await Promise.all([
    getProjects(),
    getSystemInfo().catch(() => null),
  ]);
  const defaultProject = allProjects.length > 0 ? allProjects[0] : null;

  return (
    <SearchProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-white text-jira-navy font-sans antialiased">
        <Navbar
          projects={allProjects as any}
          currentProject={defaultProject as any}
        />
        <main className="flex-1 flex flex-col overflow-y-auto bg-jira-gray-50/50 p-6 md:p-10 items-center">
          <div className="w-full max-w-4xl">
            <GeneralSettingsView initialSystemInfo={systemInfo} />
          </div>
        </main>
      </div>
    </SearchProvider>
  );
}
