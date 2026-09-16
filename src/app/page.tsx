import { redirect } from "next/navigation";
import { getProjects } from "@/lib/actions/projects";
import { requirePageUser } from "@/lib/auth/page";

// Reads the session cookie and the database on every request; without this the
// redirect target would be baked in at build time from the build's database.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requirePageUser();

  const projects = await getProjects();
  if (projects.length > 0) {
    redirect(`/projects/${projects[0].key}/board`);
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-xl font-bold">No Projects Found</h1>
        <p className="text-sm text-gray-500 mt-2">
          You are not a member of any project yet. Create one, or ask an
          administrator to add you.
        </p>
      </div>
    </div>
  );
}
