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
