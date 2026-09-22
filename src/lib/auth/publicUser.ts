/**
 * The only user columns that may be sent to a browser.
 *
 * Kept in its own module, free of framework imports, so that any query can
 * reach for it without pulling in the request-scoped session machinery.
 */
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  role: true,
  canCreateProjects: true,
} as const;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  canCreateProjects?: boolean;
  isInstanceAdmin?: boolean;
}

/**
 * A user as shown next to content: an avatar, a name and a job title.
 *
 * Deliberately excludes the email address. Issue assignees, reporters, comment
 * authors and activity entries are readable by anyone who can read the project,
 * including visitors to a published one, so contact details must not ride along
 * with them.
 */
export const DISPLAY_USER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  role: true,
} as const;
