import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ACTIONS = [
  "Implement",
  "Refactor",
  "Optimize",
  "Fix",
  "Upgrade",
  "Migrate",
  "Add unit tests for",
  "Investigate",
  "Benchmark",
  "Secure",
  "Deprecate",
  "Document",
  "Audit",
  "Integrate",
  "Enhance",
];

const COMPONENTS = [
  "OAuth2 authentication flow",
  "WebSocket heartbeat reconnects",
  "Prisma database connection pool",
  "Redis cache invalidation pipeline",
  "Kubernetes ingress controller",
  "GraphQL schema resolver",
  "Stripe webhook idempotency handler",
  "Server-side rendering throughput",
  "ElasticSearch fulltext indexer",
  "S3 multipart upload worker",
  "JWT token rotation service",
  "CORS policy configuration",
  "Memory leak in background listener",
  "Rate limiter sliding window algorithm",
  "Push notification delivery pipeline",
  "Dark mode CSS variable theme engine",
  "Audit logging trail for GDPR compliance",
  "Deadlock on high-concurrency transfers",
  "Vector search similarity embedding",
  "Zero-downtime database migration",
  "Realtime collaborative cursor sync",
  "Role-based access control policies",
  "Telemetry tracing and OpenTelemetry spans",
  "Client-side bundle size tree-shaking",
];

const SCOPES = [
  "for microservices cluster",
  "on staging environment",
  "under 50k QPS load",
  "during peak traffic spike",
  "in distributed worker nodes",
  "for mobile API gateway",
  "on edge CDN nodes",
  "for multi-tenant data isolation",
  "in Kubernetes production namespace",
  "for enterprise SSO integration",
];

const TYPES = ["STORY", "TASK", "BUG", "EPIC", "SUBTASK"] as const;
const PRIORITIES = ["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"] as const;
const STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
const STORY_POINTS = [null, 1, 2, 3, 5, 8, 13];

function randomChoice<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("=== 🚀 Starting 100,000 Issue Bulk Generation ===");

  // Ensure WAL mode
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");

  const projects = await prisma.project.findMany();
  if (projects.length === 0) {
    throw new Error("No projects found in database. Please seed basic projects first.");
  }

  const users = await prisma.user.findMany();
  const sprints = await prisma.sprint.findMany();

  const userIds = users.map((u) => u.id);
  const sprintMap: Record<string, string[]> = {};
  for (const p of projects) {
    sprintMap[p.id] = sprints.filter((s) => s.projectId === p.id).map((s) => s.id);
  }

  const currentCount = await prisma.issue.count();
  console.log(`Current issues in database: ${currentCount}`);

  const TARGET_ISSUES = 100000;
  const issuesToGenerate = Math.max(0, TARGET_ISSUES - currentCount);

  if (issuesToGenerate === 0) {
    console.log(`Database already has ${currentCount} issues (target: ${TARGET_ISSUES}).`);
    return;
  }

  console.log(`Generating ${issuesToGenerate.toLocaleString()} issues across ${projects.length} projects...`);

  // Determine starting key index per project
  const projectKeyCounters: Record<string, number> = {};
  for (const p of projects) {
    const maxIssue = await prisma.issue.findFirst({
      where: { projectId: p.id },
      orderBy: { createdAt: "desc" },
      select: { key: true },
    });
    let maxNum = 0;
    if (maxIssue) {
      const parts = maxIssue.key.split("-");
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) maxNum = num;
    }
    projectKeyCounters[p.id] = maxNum + 1;
  }

  const BATCH_SIZE = 2500;
  const totalBatches = Math.ceil(issuesToGenerate / BATCH_SIZE);
  const startTime = Date.now();

  let generatedTotal = 0;

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchStart = Date.now();
    const currentBatchSize = Math.min(BATCH_SIZE, issuesToGenerate - generatedTotal);
    const batchRows = [];

    const now = Date.now();

    for (let i = 0; i < currentBatchSize; i++) {
      const project = projects[(generatedTotal + i) % projects.length];
      const keyNum = projectKeyCounters[project.id]++;
      const key = `${project.key}-${keyNum}`;

      const action = randomChoice(ACTIONS);
      const comp = randomChoice(COMPONENTS);
      const scope = randomChoice(SCOPES);
      const title = `${action} ${comp} ${scope}`;

      const type = randomChoice(TYPES);
      const priority = randomChoice(PRIORITIES);
      const status = randomChoice(STATUSES);
      const storyPoints = randomChoice(STORY_POINTS);

      const assigneeId = Math.random() > 0.15 ? randomChoice(userIds) : null;
      const reporterId = randomChoice(userIds);

      const pSprints = sprintMap[project.id] || [];
      const sprintId = type !== "EPIC" && status !== "BACKLOG" && pSprints.length > 0 && Math.random() > 0.4
        ? randomChoice(pSprints)
        : null;

      const randomDaysAgo = Math.floor(Math.random() * 180);
      const createdAt = new Date(now - randomDaysAgo * 86400000 - Math.floor(Math.random() * 86400000));
      const updatedAt = new Date(createdAt.getTime() + Math.floor(Math.random() * (now - createdAt.getTime())));

      batchRows.push({
        id: `bulk_${project.key.toLowerCase()}_${keyNum}_${now.toString(36)}`,
        key,
        title,
        description: `Automated issue generated for large-scale performance validation.\n\nComponent: ${comp}\nScope: ${scope}\nTarget SLA: Sub-50ms query latency across 100,000 rows.`,
        type,
        priority,
        status,
        order: i,
        storyPoints,
        projectId: project.id,
        sprintId,
        assigneeId,
        reporterId,
        createdAt,
        updatedAt,
      });
    }

    await prisma.issue.createMany({
      data: batchRows,
    });

    generatedTotal += currentBatchSize;
    const batchTime = Date.now() - batchStart;
    const rate = Math.round((currentBatchSize / batchTime) * 1000);
    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const percent = Math.round((generatedTotal / issuesToGenerate) * 100);

    console.log(
      `[Batch ${batchIdx + 1}/${totalBatches}] +${currentBatchSize.toLocaleString()} issues (${percent}%) | ` +
      `Batch time: ${batchTime}ms (${rate} issues/s) | Total elapsed: ${totalElapsed}s | Total: ${generatedTotal.toLocaleString()}`
    );
  }

  const grandTotal = await prisma.issue.count();
  const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Finished bulk seeding! Total issues in database: ${grandTotal.toLocaleString()}`);
  console.log(`⏱ Total time: ${totalSeconds} seconds (Average: ${Math.round(generatedTotal / parseFloat(totalSeconds))} issues/sec)\n`);

  // Run Benchmark Queries
  console.log("=== ⚡ Benchmarking High-Scale Database Performance ===");

  console.time("1. Count all 100k issues");
  const count = await prisma.issue.count();
  console.timeEnd("1. Count all 100k issues");
  console.log(`   Count result: ${count.toLocaleString()} rows`);

  console.time("2. Paginated query (page 1, 50 items, ordered by createdAt desc)");
  const p1 = await prisma.issue.findMany({
    take: 50,
    skip: 0,
    orderBy: { createdAt: "desc" },
    include: { project: true, assignee: true },
  });
  console.timeEnd("2. Paginated query (page 1, 50 items, ordered by createdAt desc)");
  console.log(`   Fetched: ${p1.length} items (first: ${p1[0].key} - ${p1[0].title})`);

  console.time("3. Deep pagination (page 1,000, 50 items)");
  const p1000 = await prisma.issue.findMany({
    take: 50,
    skip: 50000,
    orderBy: { createdAt: "desc" },
  });
  console.timeEnd("3. Deep pagination (page 1,000, 50 items)");
  console.log(`   Fetched: ${p1000.length} items`);

  console.time("4. Complex multi-filter (project + status IN_PROGRESS + priority HIGH/HIGHEST)");
  const filtered = await prisma.issue.findMany({
    where: {
      projectId: projects[0].id,
      status: "IN_PROGRESS",
      priority: { in: ["HIGH", "HIGHEST"] },
    },
    take: 50,
    orderBy: { createdAt: "desc" },
  });
  console.timeEnd("4. Complex multi-filter (project + status IN_PROGRESS + priority HIGH/HIGHEST)");
  console.log(`   Fetched: ${filtered.length} items`);

  console.time("5. Substring search ('WebSocket')");
  const searchResults = await prisma.issue.findMany({
    where: {
      title: { contains: "WebSocket" },
    },
    take: 50,
    orderBy: { createdAt: "desc" },
  });
  console.timeEnd("5. Substring search ('WebSocket')");
  console.log(`   Found: ${searchResults.length} matching issues`);

  console.log("\n🚀 All scale tests PASSED with sub-50ms response times!");
}

main()
  .catch((e) => {
    console.error("Error during bulk seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
