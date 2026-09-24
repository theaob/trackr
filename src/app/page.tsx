import { redirect } from "next/navigation";
import { getProjects } from "@/lib/actions/projects";
import { getCurrentUser } from "@/lib/auth/session";
import { isSetupNeeded } from "@/lib/actions/setup";

// Reads the session cookie and the database on every request; without this the
// redirect target would be baked in at build time from the build's database.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // No session is required: a visitor still sees any project published to
  // anonymous viewers, and only lands on the sign-in screen when there is
  // genuinely nothing for them.
  const [user, projects, setupNeeded] = await Promise.all([
    getCurrentUser(),
    getProjects(),
    isSetupNeeded(),
  ]);

  if (setupNeeded) redirect("/setup");
  // The redesigned shell starts on Home: your work first, projects below.
  if (user?.useNewLayout) redirect("/home");

  if (projects.length > 0) {
    redirect(`/projects/${projects[0].key}/board`);
  }

  if (!user) redirect("/login");

  return (
    <div className="flex h-screen w-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-xl font-bold">No Projects Found</h1>
        <p className="text-sm text-muted mt-2">
          You are not a member of any project yet. Create one, or ask an
          administrator to add you.
        </p>
      </div>
    </div>
  );
}
