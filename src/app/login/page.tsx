import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import LoginView from "@/components/auth/LoginView";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { sso_error?: string; next?: string };
}) {
  const user = await getCurrentUser();
  if (user) redirect("/projects");

  return <LoginView ssoError={searchParams?.sso_error} />;
}
