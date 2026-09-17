import { describe, expect, it } from "vitest";
import { DEFAULT_WORKFLOW_STATUSES, seedDefaultWorkflow } from "@/lib/workflow";

/** A fake Prisma client just capable enough for seedDefaultWorkflow. */
function fakeClient() {
  const statuses: { id: string; data: any }[] = [];
  let created: any[] = [];
  return {
    client: {
      workflowStatus: {
        create: async ({ data }: any) => {
          const row = { id: `id-${statuses.length}`, ...data };
          statuses.push({ id: row.id, data });
          return row;
        },
      },
      workflowTransition: {
        createMany: async ({ data }: any) => {
          created = data;
        },
      },
    },
    getCreatedTransitions: () => created,
  };
}

describe("seedDefaultWorkflow", () => {
  it("creates the 5 default statuses with their known names", async () => {
    const { client } = fakeClient();
    const result = await seedDefaultWorkflow(client, "proj-1");
    expect(result.map((s: any) => s.name)).toEqual(
      DEFAULT_WORKFLOW_STATUSES.map((s) => s.name)
    );
  });

  it("fully connects every status to every other status (no self-loops)", async () => {
    const { client, getCreatedTransitions } = fakeClient();
    await seedDefaultWorkflow(client, "proj-1");
    const transitions = getCreatedTransitions();

    const n = DEFAULT_WORKFLOW_STATUSES.length;
    expect(transitions).toHaveLength(n * (n - 1));
    expect(transitions.every((t: any) => t.fromId !== t.toId)).toBe(true);
    expect(transitions.every((t: any) => t.projectId === "proj-1")).toBe(true);
  });

  it("marks exactly one status as the backlog status, matching the legacy default", async () => {
    const { client } = fakeClient();
    const result = await seedDefaultWorkflow(client, "proj-1");
    const backlog = result.filter((s: any) => s.isBacklog);
    expect(backlog).toHaveLength(1);
    expect(backlog[0].name).toBe("BACKLOG");
  });
});
