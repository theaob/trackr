import { redirect } from "next/navigation";
import { getCurrentUser, SessionUser } from "@/lib/auth/session";

/** Resolve the signed-in user for a page, or send the visitor to sign in. */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
