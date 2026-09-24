import React from "react";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page";
import { getAllProjectsWithStats, getAllUsers, getProjects } from "@/lib/actions/projects";
import { getHomeData } from "@/lib/actions/home";
import ShellPage from "@/components/shell/ShellPage";
import HomeView from "@/components/home/HomeView";

export const dynamic = "force-dynamic";

export const metadata = { title: "Home · Trackr" };

export default async function HomePage() {
  const user = await requirePageUser("/home");
  // Home is part of the new layout; the classic one starts at Projects.
  if (!user.useNewLayout) redirect("/projects");

  const [projects, users, data, projectStats] = await Promise.all([
    getProjects(),
    getAllUsers(),
    getHomeData(),
    getAllProjectsWithStats(),
  ]);

  return (
    <ShellPage projects={projects as any} users={users as any}>
      <HomeView data={data} projects={projectStats as any} />
    </ShellPage>
  );
}
