/**
 * Filesystem side of attachments. Deliberately not a "use server" file: its
 * exports touch disk with no auth check of their own, so they must only ever
 * be called from within an already-authorized server action or route
 * handler, never directly from the client.
 */

import { promises as fs } from "fs";
import crypto from "crypto";
import path from "path";
import { attachmentDir } from "@/lib/paths";

async function ensureAttachmentDir(issueId: string) {
  await fs.mkdir(attachmentDir(issueId), { recursive: true });
}

/** A random on-disk name, independent of the user-supplied file name. */
export function newStoredName(): string {
  return crypto.randomUUID();
}

export async function writeAttachmentFile(issueId: string, storedName: string, buffer: Buffer) {
  await ensureAttachmentDir(issueId);
  await fs.writeFile(path.join(attachmentDir(issueId), storedName), buffer);
}

export async function readAttachmentFile(issueId: string, storedName: string): Promise<Buffer> {
  return fs.readFile(path.join(attachmentDir(issueId), storedName));
}

export async function deleteAttachmentFile(issueId: string, storedName: string) {
  try {
    await fs.unlink(path.join(attachmentDir(issueId), storedName));
  } catch {
    // Already gone; nothing to clean up.
  }
}

/** Best-effort: called after an issue's row (and its attachment rows, via cascade) is deleted. */
export async function deleteIssueAttachmentDir(issueId: string) {
  try {
    await fs.rm(attachmentDir(issueId), { recursive: true, force: true });
  } catch {
    // Best effort -- an orphaned directory is a disk-space leak, not a correctness issue.
  }
}
