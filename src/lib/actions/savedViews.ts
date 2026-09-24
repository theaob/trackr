"use server";

import prisma from "@/lib/db";
import { requireUser, toActionError } from "@/lib/auth/guards";
import { normalizeColumns, type ColumnId, type ViewDefinition } from "@/lib/issueQuery";
import { TQLParser } from "@/lib/tql/parser";

const MAX_VIEWS = 50;
const MAX_NAME = 80;
const MAX_TQL = 4000;

function toDefinition(row: { id: string; name: string; tql: string; columns: string }): ViewDefinition {
  let columns: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.columns);
    if (Array.isArray(parsed)) columns = parsed.filter((c): c is string => typeof c === "string");
  } catch {}
  return { id: row.id, name: row.name, tql: row.tql, columns: normalizeColumns(columns) };
}

/** Checks a view before it's stored; the reason if it can't be. */
function invalid(input: { name?: string; tql?: string }): string | null {
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return "Give the view a name.";
    if (name.length > MAX_NAME) return `Keep the name under ${MAX_NAME} characters.`;
  }
  if (input.tql !== undefined) {
    if (input.tql.length > MAX_TQL) return "That query is too long to save.";
    const parsed = TQLParser.parse(input.tql);
    if (!parsed.success) return `The query has an error: ${parsed.error.message}`;
  }
  return null;
}

/** The signed-in person's saved views, oldest first. */
export async function listSavedViews(): Promise<ViewDefinition[]> {
  try {
    const user = await requireUser();
    const rows = await prisma.savedView.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    return rows.map(toDefinition);
  } catch {
    return [];
  }
}

export async function createSavedView(input: { name: string; tql: string; columns: ColumnId[] }) {
  try {
    const user = await requireUser();
    const problem = invalid(input);
    if (problem) return { success: false as const, error: problem };
    const count = await prisma.savedView.count({ where: { userId: user.id } });
    if (count >= MAX_VIEWS) return { success: false as const, error: `You can save up to ${MAX_VIEWS} views. Delete one first.` };
    const row = await prisma.savedView.create({
      data: { userId: user.id, name: input.name.trim(), tql: input.tql, columns: JSON.stringify(normalizeColumns(input.columns)) },
    });
    return { success: true as const, view: toDefinition(row) };
  } catch (error) {
    return toActionError(error, "Failed to save the view");
  }
}

export async function updateSavedView(id: string, input: { name?: string; tql?: string; columns?: ColumnId[] }) {
  try {
    const user = await requireUser();
    const problem = invalid(input);
    if (problem) return { success: false as const, error: problem };
    // Only the owner's own views: someone else's id finds nothing.
    const existing = await prisma.savedView.findFirst({ where: { id, userId: user.id } });
    if (!existing) return { success: false as const, error: "That view no longer exists." };
    const row = await prisma.savedView.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.tql !== undefined && { tql: input.tql }),
        ...(input.columns !== undefined && { columns: JSON.stringify(normalizeColumns(input.columns)) }),
      },
    });
    return { success: true as const, view: toDefinition(row) };
  } catch (error) {
    return toActionError(error, "Failed to update the view");
  }
}

export async function deleteSavedView(id: string) {
  try {
    const user = await requireUser();
    const { count } = await prisma.savedView.deleteMany({ where: { id, userId: user.id } });
    if (!count) return { success: false as const, error: "That view no longer exists." };
    return { success: true as const };
  } catch (error) {
    return toActionError(error, "Failed to delete the view");
  }
}
