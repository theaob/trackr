"use server";

import packageJson from "../../../package.json";
import { execSync } from "child_process";
import prisma from "@/lib/db";
import { requireAnyProjectAdmin } from "@/lib/auth/guards";
import { SystemInfo } from "@/lib/systemUtils";

export type { SystemInfo };

let cachedCommit: string | null = null;

export async function getGitCommitHash(): Promise<string> {
  if (cachedCommit) return cachedCommit;
  if (process.env.GIT_COMMIT) {
    cachedCommit = process.env.GIT_COMMIT.slice(0, 7);
    return cachedCommit;
  }
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    cachedCommit = process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
    return cachedCommit;
  }
  try {
    cachedCommit = execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return cachedCommit;
  } catch {
    cachedCommit = "dfb2de3";
    return cachedCommit;
  }
}

export async function getSystemInfo(): Promise<SystemInfo> {
  await requireAnyProjectAdmin();

  const [totalProjects, totalIssues, totalUsers, commitHash] = await Promise.all([
    prisma.project.count(),
    prisma.issue.count(),
    prisma.user.count(),
    getGitCommitHash(),
  ]);

  return {
    version: packageJson.version || "0.15.0",
    commitHash,
    environment: process.env.NODE_ENV || "development",
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    nextVersion: (packageJson.dependencies as Record<string, string>)?.next?.replace("^", "") || "14.2.23",
    databaseProvider: "SQLite",
    uptimeSeconds: Math.floor(process.uptime()),
    totalProjects,
    totalIssues,
    totalUsers,
  };
}
