import crypto from "crypto";

export interface SystemInfo {
  version: string;
  commitHash: string;
  environment: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  nextVersion: string;
  databaseProvider: string;
  uptimeSeconds: number;
  totalProjects: number;
  totalIssues: number;
  totalUsers: number;
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMinutes}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h ${remainingMinutes}m`;
}

export function formatPlatform(platform: string, arch: string): string {
  const osMap: Record<string, string> = {
    darwin: "macOS",
    linux: "Linux",
    win32: "Windows",
  };
  const osName = osMap[platform] || platform;
  return `${osName} (${arch})`;
}

export function resolveCommitHash(options?: {
  env?: Record<string, string | undefined>;
  buildInfo?: { commitHash?: string } | null;
  gitCommitGetter?: () => string;
  fallbackVersion?: string;
}): string {
  const env = options?.env ?? process.env;
  const envCommit =
    env.GIT_COMMIT ||
    env.NEXT_PUBLIC_GIT_COMMIT ||
    env.GITHUB_SHA ||
    env.VERCEL_GIT_COMMIT_SHA;

  if (envCommit) {
    return envCommit.slice(0, 7);
  }

  if (options?.buildInfo?.commitHash) {
    return String(options.buildInfo.commitHash).slice(0, 7);
  }

  if (options?.gitCommitGetter) {
    try {
      const gitVal = options.gitCommitGetter();
      if (gitVal) return gitVal.slice(0, 7);
    } catch {}
  }

  // Generate deterministic 7-char hash from version as fallback
  const version = options?.fallbackVersion || "0.0.0";
  try {
    return crypto.createHash("sha256").update(version).digest("hex").slice(0, 7);
  } catch {
    let hash = 0;
    for (let i = 0; i < version.length; i++) {
      hash = (hash << 5) - hash + version.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(7, "0").slice(-7);
  }
}

