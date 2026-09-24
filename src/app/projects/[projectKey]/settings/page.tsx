import React from "react";
import { notFound } from "next/navigation";
import { getProjectByKey, getAllUsers } from "@/lib/actions/projects";
import { getProjectCustomFields } from "@/lib/actions/customFields";
import { getProjectComponents } from "@/lib/actions/components";
import { getProjectWebhooks } from "@/lib/actions/webhooks";
import { getProjectMembers, getProjectCustomRoles } from "@/lib/actions/access";
import { getProjectWorkflow } from "@/lib/actions/workflows";
import ProjectSettingsView from "@/components/settings/ProjectSettingsView";
import { requirePageUser } from "@/lib/auth/page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ projectKey: string }>;
  searchParams: Promise<{ section?: string }>;
}

export default async function SettingsPage({ params, searchParams }: PageProps) {
  const { projectKey } = await params;
  const { section } = await searchParams;
  await requirePageUser(`/projects/${projectKey}/settings`);

  const project = await getProjectByKey(projectKey);
  if (!project) notFound();

  const [users, customFields, components, webhooks, members, workflow, customRoles] = await Promise.all([
    // The full directory here, because this is where members are invited.
    getAllUsers(),
    getProjectCustomFields(project.id),
    getProjectComponents(project.id),
    // Returns [] for non-administrators; the tab is hidden for them anyway.
    getProjectWebhooks(project.id),
    getProjectMembers(project.id),
    getProjectWorkflow(project.id),
    getProjectCustomRoles(project.id),
  ]);

  return (
    <ProjectSettingsView
      project={project as any}
      users={users as any}
      initialCustomFields={customFields as any}
      initialComponents={components as any}
      initialWebhooks={webhooks as any}
      initialMembers={members as any}
      initialCustomRoles={customRoles as any}
      initialWorkflowStatuses={workflow.statuses as any}
      initialWorkflowTransitions={workflow.transitions as any}
      initialSection={section}
    />
  );
}
