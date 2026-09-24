import prisma from "@/lib/db";
import { issueHref } from "@/lib/issueUrls";

/**
 * Escape a string for literal use inside a regular expression.
 *
 * User names are interpolated into mention patterns; without escaping, a name
 * like "C++" or "(dev)" produces an invalid pattern that throws and breaks
 * every issue write, and a crafted name is a denial-of-service vector.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface MentionCandidate {
  id: string;
  name: string;
}

/** True when `text` mentions `name` as @Full Name, @[Full Name] or @First. */
export function mentionsUser(text: string, name: string): boolean {
  if (!text || !name) return false;

  const lower = text.toLowerCase();
  const lowerName = name.toLowerCase();

  if (lower.includes(`@${lowerName}`)) return true;
  if (lower.includes(`@[${lowerName}]`)) return true;

  const firstName = name.split(" ")[0];
  if (!firstName) return false;

  // \B before @ keeps "alex@example.com" from counting as a mention; the
  // trailing lookahead stands in for \b, which would never match after a name
  // that ends in punctuation such as "C++".
  return new RegExp(`\\B@${escapeRegExp(firstName)}(?!\\w)`, "i").test(text);
}

/**
 * Users mentioned in `text` who can open the issue: the project lead, its
 * members, and on a project published to anonymous viewers, everyone.
 *
 * Nobody who can't open the issue is told about it, since the notice quotes
 * the text.
 */
export async function findMentionedUsers(
  projectId: string,
  text: string,
  options: { exclude?: (string | null | undefined)[]; previousText?: string | null } = {}
): Promise<MentionCandidate[]> {
  if (!text?.trim()) return [];

  const excluded = new Set(options.exclude?.filter(Boolean) as string[]);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { leadId: true, allowAnonymousViewers: true },
  });
  if (!project) return [];

  const candidates: MentionCandidate[] = project.allowAnonymousViewers
    ? await prisma.user.findMany({ select: { id: true, name: true } })
    : await prisma.user.findMany({
        where: {
          OR: [{ projectMembers: { some: { projectId } } }, ...(project.leadId ? [{ id: project.leadId }] : [])],
        },
        select: { id: true, name: true },
      });

  return candidates.filter((user) => {
    if (excluded.has(user.id)) return false;
    if (!mentionsUser(text, user.name)) return false;
    // On an edit, only mentions that are new count.
    if (options.previousText && mentionsUser(options.previousText, user.name)) return false;
    return true;
  });
}

/**
 * Tells everyone mentioned in a comment or description, and records it in the
 * issue's history. Only the author is left out: the assignee, the reporter and
 * watchers all get the mention itself. Returns who was notified.
 */
export async function notifyMentions({
  issue,
  text,
  previousText,
  actor,
  where,
}: {
  issue: { id: string; key: string; projectId: string; projectKey: string };
  text: string | null | undefined;
  previousText?: string | null;
  actor: { id: string; name: string };
  where: "comment" | "description";
}): Promise<string[]> {
  const mentioned = await findMentionedUsers(issue.projectId, text ?? "", { exclude: [actor.id], previousText });
  if (mentioned.length === 0) return [];

  const snippet = `${(text ?? "").slice(0, 60)}${(text ?? "").length > 60 ? "..." : ""}`;
  await prisma.notification.createMany({
    data: mentioned.map((user) => ({
      userId: user.id,
      title: where === "comment" ? `Mentioned in a comment on ${issue.key}` : `Mentioned in ${issue.key}`,
      message: `${actor.name} mentioned you: "${snippet}"`,
      link: issueHref(issue.projectKey, issue.key),
    })),
  });
  await prisma.activityLog.createMany({
    data: mentioned.map((user) => ({
      issueId: issue.id,
      userId: actor.id,
      action: "MENTIONED",
      field: where,
      newValue: user.name,
    })),
  });
  return mentioned.map((user) => user.id);
}
