import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

const MAX_ATTEMPTS = 25;

/**
 * Create an issue with the next free key for its project.
 *
 * The key is derived from the highest existing number rather than a row count,
 * so deletions do not cause collisions, and a unique-constraint violation from
 * a concurrent create is retried instead of surfacing as a failed save.
 */
export async function createIssueWithKey<T>(
  projectId: string,
  projectKey: string,
  build: (key: string) => Prisma.PrismaPromise<T>
): Promise<T> {
  let attempt = 0;
  let nextNumber = (await highestIssueNumber(projectId, projectKey)) + 1;

  for (;;) {
    try {
      return await build(`${projectKey}-${nextNumber}`);
    } catch (error) {
      const isDuplicateKey =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

      if (!isDuplicateKey || ++attempt >= MAX_ATTEMPTS) throw error;

      // Another request took this number; re-read and try the next one.
      nextNumber = Math.max(
        nextNumber + 1,
        (await highestIssueNumber(projectId, projectKey)) + 1
      );
    }
  }
}

async function highestIssueNumber(projectId: string, projectKey: string): Promise<number> {
  const numberStart = projectKey.length + 2; // SUBSTR is 1-based, past "KEY-"

  try {
    const rows = await prisma.$queryRaw<Array<{ maxNum: number | bigint | null }>>`
      SELECT MAX(CAST(SUBSTR("key", ${numberStart}) AS INTEGER)) AS "maxNum"
      FROM "Issue"
      WHERE "projectId" = ${projectId} AND "key" LIKE ${`${projectKey}-%`}
    `;

    const maxNum = rows[0]?.maxNum;
    if (maxNum != null) return Number(maxNum);
  } catch (error) {
    console.error("Failed to read the highest issue number, falling back:", error);
  }

  return prisma.issue.count({ where: { projectId } });
}
