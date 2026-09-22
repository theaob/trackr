import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

const MAX_ATTEMPTS = 25;

/**
 * Orders issue keys like "APOLLO-2" before "APOLLO-10". A plain string sort
 * (what SQL's ORDER BY key does) compares the number as text, so "APOLLO-10"
 * sorts before "APOLLO-2" once a project passes 9 issues.
 */
export function compareIssueKeys(a: string, b: string): number {
  const matchA = a.match(/^(.*-)(\d+)$/);
  const matchB = b.match(/^(.*-)(\d+)$/);
  if (!matchA || !matchB) return a.localeCompare(b);

  const [, prefixA, numA] = matchA;
  const [, prefixB, numB] = matchB;
  if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
  return Number(numA) - Number(numB);
}

/**
 * Per-project queue of in-flight key allocations.
 *
 * The retry below is what makes the operation correct across processes; this
 * queue simply stops a single process from racing itself, which would turn
 * every concurrent create into a logged unique-constraint violation.
 */
const allocationQueues = new Map<string, Promise<unknown>>();

function serializePerProject<T>(projectId: string, task: () => Promise<T>): Promise<T> {
  const previous = allocationQueues.get(projectId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(task);

  // Keep the chain from growing without bound once it goes idle.
  allocationQueues.set(projectId, next);
  void next.catch(() => {}).finally(() => {
    if (allocationQueues.get(projectId) === next) {
      allocationQueues.delete(projectId);
    }
  });

  return next;
}

/**
 * Create an issue with the next free key for its project.
 *
 * The key is derived from the highest existing number rather than a row count,
 * so deletions do not cause collisions, and a unique-constraint violation from
 * a concurrent create is retried instead of surfacing as a failed save.
 */
export function createIssueWithKey<T>(
  projectId: string,
  projectKey: string,
  build: (key: string) => Prisma.PrismaPromise<T>
): Promise<T> {
  return serializePerProject(projectId, () => allocateAndCreate(projectId, projectKey, build));
}

async function allocateAndCreate<T>(
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
