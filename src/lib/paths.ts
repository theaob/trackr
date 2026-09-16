import path from "path";

/**
 * Writable data directory. Matches the volume mounted at /app/data by the
 * Docker image; falls back to ./data for local development.
 */
export function dataDir(): string {
  if (process.env.TRACKR_DATA_DIR) return process.env.TRACKR_DATA_DIR;
  return path.join(process.cwd(), "data");
}

export function avatarDir(): string {
  return path.join(dataDir(), "avatars");
}
