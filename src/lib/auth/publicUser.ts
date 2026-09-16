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
} as const;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
}
