import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const packageJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
);

function resolveCommit() {
  const envCommit =
    process.env.GIT_COMMIT ||
    process.env.NEXT_PUBLIC_GIT_COMMIT ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA;

  if (envCommit) {
    return envCommit.slice(0, 7);
  }

  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    // If build-info.json exists, use it
    try {
      const info = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "build-info.json"), "utf8")
      );
      if (info.commitHash) return String(info.commitHash).slice(0, 7);
    } catch {}

    // Deterministic fallback from version rather than static string
    return crypto
      .createHash("sha256")
      .update(packageJson.version || "0.0.0")
      .digest("hex")
      .slice(0, 7);
  }
}

const commitHash = resolveCommit();

try {
  const buildInfo = {
    version: packageJson.version,
    commitHash,
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(process.cwd(), "build-info.json"),
    JSON.stringify(buildInfo, null, 2) + "\n"
  );
} catch {}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: false, // helps with @hello-pangea/dnd animations in development
  env: {
    GIT_COMMIT: commitHash,
    NEXT_PUBLIC_GIT_COMMIT: commitHash,
  },
};

export default nextConfig;
