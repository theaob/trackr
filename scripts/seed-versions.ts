import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== 🏷️ Seeding Sample Project Versions & Linking Issues ===");

  const projects = await prisma.project.findMany();
  console.log(`Found ${projects.length} projects`);

  for (const project of projects) {
    const existingVersions = await prisma.version.findMany({
      where: { projectId: project.id },
    });

    if (existingVersions.length > 0) {
      console.log(`Project ${project.key} already has ${existingVersions.length} versions. Skipping.`);
      continue;
    }

    console.log(`Creating versions for ${project.key} (${project.name})...`);

    const now = Date.now();
    const dayMs = 86400000;

    // 1. v1.0.0 (RELEASED)
    const v1 = await prisma.version.create({
      data: {
        name: "1.0.0",
        description: `Initial stable release of ${project.name} with core pipeline architecture, baseline APIs, and observability.`,
        status: "RELEASED",
        startDate: new Date(now - 90 * dayMs),
        releaseDate: new Date(now - 30 * dayMs),
        projectId: project.id,
      },
    });

    // 2. v1.1.0 (UNRELEASED, In Progress)
    const v11 = await prisma.version.create({
      data: {
        name: "1.1.0",
        description: `Performance optimizations, connection pool tuning, and advanced audit trails.`,
        status: "UNRELEASED",
        startDate: new Date(now - 30 * dayMs),
        releaseDate: new Date(now + 14 * dayMs),
        projectId: project.id,
      },
    });

    // 3. v2.0.0-rc1 (UNRELEASED, Future)
    const v2 = await prisma.version.create({
      data: {
        name: "2.0.0-rc1",
        description: `Major upgrade introducing distributed multi-region clustering and zero-downtime migrations.`,
        status: "UNRELEASED",
        startDate: new Date(now - 5 * dayMs),
        releaseDate: new Date(now + 60 * dayMs),
        projectId: project.id,
      },
    });

    // Assign sample issues from this project to these versions
    // Find some DONE issues for v1.0.0
    const doneIssues = await prisma.issue.findMany({
      where: { projectId: project.id, status: "DONE" },
      take: 12,
    });
    if (doneIssues.length > 0) {
      await prisma.issue.updateMany({
        where: { id: { in: doneIssues.map((i) => i.id) } },
        data: { versionId: v1.id },
      });
    }

    // Find some IN_PROGRESS and TODO issues for v1.1.0
    const inProgressIssues = await prisma.issue.findMany({
      where: {
        projectId: project.id,
        status: { in: ["IN_PROGRESS", "IN_REVIEW", "DONE", "TODO"] },
        versionId: null,
      },
      take: 15,
    });
    if (inProgressIssues.length > 0) {
      await prisma.issue.updateMany({
        where: { id: { in: inProgressIssues.map((i) => i.id) } },
        data: { versionId: v11.id },
      });
    }

    // Find some TODO and BACKLOG issues for v2.0.0-rc1
    const futureIssues = await prisma.issue.findMany({
      where: {
        projectId: project.id,
        versionId: null,
      },
      take: 10,
    });
    if (futureIssues.length > 0) {
      await prisma.issue.updateMany({
        where: { id: { in: futureIssues.map((i) => i.id) } },
        data: { versionId: v2.id },
      });
    }

    console.log(`✅ Created 3 versions for ${project.key} and linked sample issues.`);
  }

  const vCount = await prisma.version.count();
  console.log(`\n🎉 Total versions in system: ${vCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
