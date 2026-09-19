import { NextRequest, NextResponse } from "next/server";
import { validatePersonalAccessToken } from "@/lib/auth/tokens";
import { accessibleProjectIds } from "@/lib/auth/guards";
import prisma from "@/lib/db";
import { TQLParser } from "@/lib/tql/parser";
import { TQLCompiler } from "@/lib/tql/compiler";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Unauthorized. Please provide a Bearer Personal Access Token." },
      { status: 401 }
    );
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const auth = await validatePersonalAccessToken(token);

  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  // A token carries its owner's access and no more: the query is confined to
  // the projects that user belongs to.
  const allowedProjectIds = await accessibleProjectIds(auth.user.id);
  if (allowedProjectIds.length === 0) {
    return NextResponse.json({
      authenticatedUser: {
        id: auth.user.id,
        name: auth.user.name,
        email: auth.user.email,
      },
      count: 0,
      issues: [],
    });
  }

  const { searchParams } = new URL(request.url);
  const tqlParam = searchParams.get("tql");
  const projectKey = searchParams.get("projectKey");
  const limitParam = searchParams.get("limit");
  const limit = limitParam
    ? Math.min(Math.max(parseInt(limitParam, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  let where: any = { projectId: { in: allowedProjectIds } };
  let orderBy: any = { createdAt: "desc" };

  if (tqlParam && tqlParam.trim()) {
    const parseRes = TQLParser.parse(tqlParam);
    if (!parseRes.success) {
      return NextResponse.json(
        { error: `TQL Syntax Error: ${parseRes.error.message}`, details: parseRes.error },
        { status: 400 }
      );
    }

    const [activeSprints, unreleasedVersions] = await Promise.all([
      prisma.sprint.findMany({
        where: { projectId: { in: allowedProjectIds }, status: "ACTIVE" },
        select: { id: true },
      }),
      prisma.version.findMany({
        where: { projectId: { in: allowedProjectIds }, status: "UNRELEASED" },
        select: { id: true },
      }),
    ]);

    const compiler = new TQLCompiler({
      currentUserId: auth.user.id,
      accessibleProjectIds: allowedProjectIds,
      activeSprintIds: activeSprints.map((s) => s.id),
      unreleasedVersionIds: unreleasedVersions.map((v) => v.id),
    });

    const compiled = compiler.compile(parseRes.query);
    where = compiled.where;
    if (compiled.orderBy.length > 0) {
      orderBy = compiled.orderBy;
    }
  } else if (projectKey) {
    const project = await prisma.project.findUnique({
      where: { key: projectKey.toUpperCase() },
      select: { id: true },
    });

    // An inaccessible or unknown key is reported the same way, so the endpoint
    // does not confirm the existence of projects the caller cannot see.
    if (!project || !allowedProjectIds.includes(project.id)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    where.projectId = project.id;
  }

  const issues = await prisma.issue.findMany({
    where,
    take: limit,
    orderBy,
    select: {
      id: true,
      key: true,
      title: true,
      type: true,
      status: true,
      priority: true,
      storyPoints: true,
      createdAt: true,
      updatedAt: true,
      project: {
        select: {
          id: true,
          name: true,
          key: true,
        },
      },
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json({
    authenticatedUser: {
      id: auth.user.id,
      name: auth.user.name,
      email: auth.user.email,
    },
    count: issues.length,
    issues,
  });
}
