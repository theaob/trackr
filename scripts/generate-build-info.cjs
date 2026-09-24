#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const crypto = require("crypto");

const packageJson = require("../package.json");

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
    return crypto
      .createHash("sha256")
      .update(packageJson.version || "0.0.0")
      .digest("hex")
      .slice(0, 7);
  }
}

const commitHash = resolveCommit();
const buildInfo = {
  version: packageJson.version,
  commitHash,
  builtAt: new Date().toISOString(),
};

const targetPath = path.join(__dirname, "..", "build-info.json");
fs.writeFileSync(targetPath, JSON.stringify(buildInfo, null, 2) + "\n");
console.log(`[Tamam] Generated build-info.json: version=${buildInfo.version}, commitHash=${buildInfo.commitHash}`);
