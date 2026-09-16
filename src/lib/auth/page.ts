import { notFound, redirect } from "next/navigation";
import { getCurrentUser, SessionUser } from "@/lib/auth/session";

/** Resolve the signed-in user for a page, or send the visitor to sign in. */
export async function requirePageUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(next));
  return user;
}

/**
 * End a page render that the caller may not see.
 *
 * A visitor is offered the sign-in screen, because signing in may well grant
 * access. Someone already signed in is shown a 404, so that the existence of a
 * project they cannot reach is not confirmed to them.
 */
export async function denyPageAccess(next?: string): Promise<never> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(next));
  notFound();
}

function loginPath(next?: string): string {
  if (!next) return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}
