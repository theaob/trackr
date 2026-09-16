import React from "react";
import { notFound } from "next/navigation";
import { getProjectByKey, getAllUsers } from "@/lib/actions/projects";
import { getProjectCustomFields } from "@/lib/actions/customFields";
import { getProjectWebhooks } from "@/lib/actions/webhooks";
import { getProjectMembers } from "@/lib/actions/access";
import ProjectSettingsView from "@/components/settings/ProjectSettingsView";

interface PageProps {
  params: { projectKey: string };
}

export default async function SettingsPage({ params }: PageProps) {
  const project = await getProjectByKey(params.projectKey);
  if (!project) notFound();

  const [users, customFields, webhooks, members] = await Promise.all([
    getAllUsers(),
    getProjectCustomFields(project.id),
    getProjectWebhooks(project.id),
    getProjectMembers(project.id),
  ]);

  return (
    <ProjectSettingsView
      project={project as any}
      users={users as any}
      initialCustomFields={customFields as any}
      initialWebhooks={webhooks as any}
      initialMembers={members as any}
    />
  );
}


