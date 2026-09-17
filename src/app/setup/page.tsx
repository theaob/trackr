import { redirect } from "next/navigation";
import { isSetupNeeded } from "@/lib/actions/setup";
import SetupView from "@/components/auth/SetupView";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Setup is a one-time gate: once any account exists, this page is a
  // dead end rather than a way to mint further privileged accounts.
  if (!(await isSetupNeeded())) redirect("/login");

  return <SetupView />;
}
