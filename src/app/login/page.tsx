import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isSetupNeeded } from "@/lib/actions/setup";
import LoginView from "@/components/auth/LoginView";

export const dynamic = "force-dynamic";

/**
 * Only same-site paths are honoured, so a crafted ?next= cannot bounce someone
 * to another host after signing in.
 */
function safeNext(next?: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/home";
  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sso_error?: string; next?: string }>;
}) {
  const query = await searchParams;
  const destination = safeNext(query.next);

  if (await isSetupNeeded()) redirect("/setup");

  const user = await getCurrentUser();
  if (user) redirect(destination);

  return <LoginView ssoError={query.sso_error} next={destination} />;
}
