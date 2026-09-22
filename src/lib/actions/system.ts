"use server";

import packageJson from "../../../package.json";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import prisma from "@/lib/db";
import { requireInstanceAdmin } from "@/lib/auth/guards";
import { SystemInfo, resolveCommitHash } from "@/lib/systemUtils";

export type { SystemInfo };

let cachedCommit: string | null = null;

export async function getGitCommitHash(): Promise<string> {
  if (process.env.NODE_ENV === "production" && cachedCommit) return cachedCommit;

  let buildInfo: { commitHash?: string } | null = null;
  try {
    const infoPath = path.join(process.cwd(), "build-info.json");
    if (fs.existsSync(infoPath)) {
      buildInfo = JSON.parse(fs.readFileSync(infoPath, "utf8"));
    }
  } catch {}

  cachedCommit = resolveCommitHash({
    buildInfo,
    gitCommitGetter: () =>
      execSync("git rev-parse --short HEAD", {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim(),
    fallbackVersion: packageJson.version,
  });

  return cachedCommit;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  await requireInstanceAdmin();

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
