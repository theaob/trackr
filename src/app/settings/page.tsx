import React from "react";
import { getProjects } from "@/lib/actions/projects";
import { getSystemInfo } from "@/lib/actions/system";
import { requirePageUser, denyPageAccess } from "@/lib/auth/page";
import { requireInstanceAdmin } from "@/lib/auth/guards";
import GeneralSettingsView from "@/components/settings/GeneralSettingsView";
import ShellPage from "@/components/shell/ShellPage";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePageUser("/settings");
  try {
    await requireInstanceAdmin();
  } catch {
    return denyPageAccess("/settings");
  }

  const [allProjects, systemInfo] = await Promise.all([
    getProjects(),
    getSystemInfo().catch(() => null),
  ]);
  return (
    <ShellPage projects={allProjects as any}>
      <div className="flex flex-1 flex-col items-center overflow-y-auto bg-page p-6 md:p-10">
        <div className="w-full max-w-6xl">
          <GeneralSettingsView initialSystemInfo={systemInfo} />
        </div>
      </div>
    </ShellPage>
  );
}
