import { redirect } from "next/navigation";
import { getProjects } from "@/lib/actions/projects";

export default async function HomePage() {
  const projects = await getProjects();
  if (projects.length > 0) {
    redirect(`/projects/${projects[0].key}/board`);
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-xl font-bold">No Projects Found</h1>
        <p className="text-sm text-gray-500 mt-2">
          Run the database seed script to populate demo data.
        </p>
      </div>
    </div>
  );
}
