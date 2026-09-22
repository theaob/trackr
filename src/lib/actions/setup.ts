"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/auth/password";
import { startSession, PUBLIC_USER_SELECT } from "@/lib/auth/session";
import { AuthError, toActionError } from "@/lib/auth/guards";
import { seedDefaultWorkflow } from "@/lib/workflow";

const MIN_PASSWORD_LENGTH = 8;
const PROJECT_KEY_PATTERN = /^[A-Z0-9]{2,10}$/;

/** True until the first account exists. Setup is a one-time gate, not a role. */
export async function isSetupNeeded(): Promise<boolean> {
  return (await prisma.user.count()) === 0;
}

/**
 * Create the instance's first account and first project together, so
 * finishing setup lands on a working project rather than an empty account
 * with nothing to administer.
 *
 * Deliberately self-contained rather than composed from registerUser +
 * createProject: those read the session cookie they just set, which is not
 * guaranteed to be visible yet within the same action invocation. Guarded
 * inside a transaction so two racing submissions can't both "win".
 */
export async function completeSetup(data: {
  name: string;
  email: string;
  password: string;
  projectName: string;
  projectKey: string;
}) {
  try {
    const email = data.email.trim().toLowerCase();
    const name = data.name.trim();
    const projectName = data.projectName.trim();
    const projectKey = data.projectKey.trim().toUpperCase();

    if (!email || !name) {
      return { success: false as const, error: "Name and email are required." };
    }
    if (!data.password || data.password.length < MIN_PASSWORD_LENGTH) {
      return {
        success: false as const,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      };
    }
    if (!projectName) {
      return { success: false as const, error: "Project name is required." };
    }
    if (!PROJECT_KEY_PATTERN.test(projectKey)) {
      return {
        success: false as const,
        error: "Project key must be 2-10 alphanumeric uppercase characters.",
      };
    }

    const passwordHash = await hashPassword(data.password);

    const { user, project } = await prisma.$transaction(async (tx) => {
      const alreadySetUp = await tx.user.count();
      if (alreadySetUp > 0) {
        throw new AuthError("Setup has already been completed.", 409);
      }

      const existingKey = await tx.project.findUnique({
        where: { key: projectKey },
        select: { id: true },
      });
      if (existingKey) {
        throw new AuthError(`A project with key ${projectKey} already exists.`, 409);
      }

      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          authProvider: "LOCAL",
          role: "Administrator",
          canCreateProjects: true,
          isInstanceAdmin: true,
        },
        select: PUBLIC_USER_SELECT,
      });

      const project = await tx.project.create({
        data: {
          name: projectName,
          key: projectKey,
          leadId: user.id,
          members: { create: [{ userId: user.id, role: "ADMIN" }] },
          sprints: {
            create: {
              name: "Sprint 1",
              status: "FUTURE",
              goal: "Initial sprint planning and setup.",
            },
          },
        },
        select: { id: true, key: true },
      });

      await seedDefaultWorkflow(tx, project.id);

      return { user, project };
    });

    startSession(user.id);

    try {
      revalidatePath("/");
    } catch {}

    return { success: true as const, user, project };
  } catch (error) {
    return toActionError(error, "Failed to complete setup");
  }
}
