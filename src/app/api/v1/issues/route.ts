import { NextRequest, NextResponse } from "next/server";
import { validatePersonalAccessToken } from "@/lib/actions/tokens";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      {
        error: "Unauthorized. Please provide a Bearer Personal Access Token.",
      },
      { status: 401 }
    );
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const auth = await validatePersonalAccessToken(token);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      {
        error: auth.error || "Invalid or expired token",
      },
      { status: 401 }
    );
  }

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const projectKey = searchParams.get("projectKey");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;

  const where: any = {};
  if (projectKey) {
    where.project = { key: projectKey.toUpperCase() };
  }

  const issues = await prisma.issue.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
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
