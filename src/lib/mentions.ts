import prisma from "@/lib/db";
import { PUBLIC_USER_SELECT } from "@/lib/auth/publicUser";

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
 * Users mentioned in `text` who can actually see the project.
 *
 * Scoped to project members rather than the whole user table: mentioning a
 * stranger should not notify them about an issue they cannot open.
 */
export async function findMentionedUsers(
  projectId: string,
  text: string,
  options: { exclude?: (string | null | undefined)[]; previousText?: string | null } = {}
): Promise<MentionCandidate[]> {
  if (!text?.trim()) return [];

  const excluded = new Set(options.exclude?.filter(Boolean) as string[]);

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { user: { select: PUBLIC_USER_SELECT } },
  });

  return members
    .map((m) => m.user)
    .filter((user) => {
      if (excluded.has(user.id)) return false;
      if (!mentionsUser(text, user.name)) return false;
      // On an edit, only notify for mentions that are newly added.
      if (options.previousText && mentionsUser(options.previousText, user.name)) {
        return false;
      }
      return true;
    })
    .map((user) => ({ id: user.id, name: user.name }));
}
