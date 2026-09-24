/**
 * Where an issue lives: /projects/APOLLO/issues/APOLLO-3, one address to
 * share, bookmark and link from notifications. The old
 * /projects/APOLLO/board?selectedIssue=APOLLO-3 form still works: the pages
 * that used to read it redirect here (see legacyIssueRedirect).
 */

/** An issue key such as APOLLO-3; project keys are letters then letters or digits. */
export const ISSUE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*-\d+$/;

/** Prisma cuid-style ids, which old links sometimes carried instead of a key. */
const ISSUE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function issueHref(projectKey: string, issueKey: string): string {
  return `/projects/${encodeURIComponent(projectKey)}/issues/${encodeURIComponent(issueKey)}`;
}

/** The project part of an issue key: APOLLO for APOLLO-3. */
export function projectKeyOfIssue(issueKey: string): string {
  return issueKey.replace(/-\d+$/, "");
}

/**
 * The issue page for a pre-redesign ?selectedIssue= (or ?issue=) link, or
 * null when there's nothing to redirect. Only a key- or id-shaped value is
 * honoured, so the parameter can't be used to build some other URL.
 */
export function legacyIssueRedirect(
  projectKey: string,
  query: { selectedIssue?: string | string[]; issue?: string | string[] }
): string | null {
  const raw = query.selectedIssue ?? query.issue;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  if (ISSUE_KEY_PATTERN.test(value)) return issueHref(projectKeyOfIssue(value.toUpperCase()), value.toUpperCase());
  if (ISSUE_ID_PATTERN.test(value)) return issueHref(projectKey, value);
  return null;
}
