import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { seedDefaultWorkflow } from "@/lib/workflow";

const prisma = new PrismaClient();

/**
 * Demo accounts need a real credential: sign-in fails closed for users with no
 * password hash. Override with TRACKR_SEED_PASSWORD; change it after seeding.
 */
const SEED_PASSWORD = process.env.TRACKR_SEED_PASSWORD || "trackr-demo";

// Mirrors the format in src/lib/auth/password.ts.
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(password, salt, 210_000, 64, "sha512");
  return ["pbkdf2", "sha512", 210_000, salt.toString("base64"), derived.toString("base64")].join("$");
}

async function main() {
  console.log("Seeding database...");

  const passwordHash = hashPassword(SEED_PASSWORD);

  // Clean existing data
  await prisma.projectMember.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.sprint.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Users
  const alex = await prisma.user.create({
    data: {
      name: "Alex Chen",
      email: "alex.chen@acme.dev",
      role: "Tech Lead",
      avatarUrl: null,
      passwordHash,
      authProvider: "LOCAL",
    },
  });

  const sarah = await prisma.user.create({
    data: {
      name: "Sarah Connor",
      email: "sarah.c@acme.dev",
      role: "Product Manager",
      avatarUrl: null,
      passwordHash,
      authProvider: "LOCAL",
    },
  });

  const david = await prisma.user.create({
    data: {
      name: "David Kim",
      email: "david.k@acme.dev",
      role: "Frontend Engineer",
      avatarUrl: null,
      passwordHash,
      authProvider: "LOCAL",
    },
  });

  const elena = await prisma.user.create({
    data: {
      name: "Elena Rostova",
      email: "elena.r@acme.dev",
      role: "Backend Architect",
      avatarUrl: null,
      passwordHash,
      authProvider: "LOCAL",
    },
  });

  const marcus = await prisma.user.create({
    data: {
      name: "Marcus Vance",
      email: "marcus.v@acme.dev",
      role: "QA Engineer",
      avatarUrl: null,
      passwordHash,
      authProvider: "LOCAL",
    },
  });

  // 2. Create Project
  const project = await prisma.project.create({
    data: {
      name: "Apollo Cloud Engine",
      key: "APOLLO",
      description: "Distributed microservices engine and cloud telemetry streaming platform.",
      leadId: alex.id,
    },
  });
  await seedDefaultWorkflow(prisma, project.id);

  // 3. Create Sprints
  const now = new Date();
  const pastWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const endPastWeek = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const nextTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const futureStart = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const futureEnd = new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000);

  const sprint1 = await prisma.sprint.create({
    data: {
      name: "Sprint 1 - Core Infrastructure",
      goal: "Finalize auth middleware and set up event pipeline.",
      status: "COMPLETED",
      startDate: pastWeek,
      endDate: endPastWeek,
      projectId: project.id,
    },
  });

  const sprint2 = await prisma.sprint.create({
    data: {
      name: "Sprint 2 - Real-time Sync & Metrics",
      goal: "Implement WebSocket telemetry broadcaster and dashboard metrics feed.",
      status: "ACTIVE",
      startDate: now,
      endDate: nextTwoWeeks,
      projectId: project.id,
    },
  });

  const sprint3 = await prisma.sprint.create({
    data: {
      name: "Sprint 3 - Billing & Multi-tenancy",
      goal: "Tenant isolation and Stripe metered usage billing integration.",
      status: "FUTURE",
      startDate: futureStart,
      endDate: futureEnd,
      projectId: project.id,
    },
  });

  // 4. Create Epics
  const epic1 = await prisma.issue.create({
    data: {
      key: "APOLLO-1",
      title: "Real-time Telemetry Pipeline",
      description: "Design and deploy the high-throughput ingest pipeline for edge cluster metrics.",
      type: "EPIC",
      priority: "HIGH",
      status: "IN_PROGRESS",
      order: 0,
      storyPoints: 21,
      projectId: project.id,
      assigneeId: elena.id,
      reporterId: sarah.id,
    },
  });

  const epic2 = await prisma.issue.create({
    data: {
      key: "APOLLO-2",
      title: "Interactive Observability UI",
      description: "Next.js dashboard with canvas rendering for latency histograms and trace trees.",
      type: "EPIC",
      priority: "MEDIUM",
      status: "TODO",
      order: 1,
      storyPoints: 13,
      projectId: project.id,
      assigneeId: david.id,
      reporterId: sarah.id,
    },
  });

  // 5. Create Issues for Active Sprint (Sprint 2)
  const task1 = await prisma.issue.create({
    data: {
      key: "APOLLO-3",
      title: "Configure WebSocket connection fallback to SSE",
      description: "When corporate firewalls terminate WebSocket handshakes, fall back gracefully to Server-Sent Events with automatic reconnection backoff.",
      type: "STORY",
      priority: "HIGH",
      status: "IN_PROGRESS",
      order: 0,
      storyPoints: 5,
      projectId: project.id,
      sprintId: sprint2.id,
      assigneeId: david.id,
      reporterId: alex.id,
      parentId: epic1.id,
    },
  });

  const task2 = await prisma.issue.create({
    data: {
      key: "APOLLO-4",
      title: "Memory leak in Prometheus exporter under high concurrency",
      description: "Heap snapshot reveals uncollected MetricMap descriptors when scrape interval drops below 2 seconds.",
      type: "BUG",
      priority: "HIGHEST",
      status: "IN_PROGRESS",
      order: 1,
      storyPoints: 8,
      projectId: project.id,
      sprintId: sprint2.id,
      assigneeId: elena.id,
      reporterId: marcus.id,
    },
  });

  const task3 = await prisma.issue.create({
    data: {
      key: "APOLLO-5",
      title: "Add keyboard shortcuts for kanban card navigation",
      description: "Support `j` and `k` to move between cards, `enter` to view details, and `e` to edit assignee.",
      type: "TASK",
      priority: "LOW",
      status: "TODO",
      order: 0,
      storyPoints: 3,
      projectId: project.id,
      sprintId: sprint2.id,
      assigneeId: alex.id,
      reporterId: sarah.id,
    },
  });

  const task4 = await prisma.issue.create({
    data: {
      key: "APOLLO-6",
      title: "Implement column WIP limit alerts in Board header",
      description: "Show amber warning badge when column exceeds max allowed work-in-progress cards.",
      type: "STORY",
      priority: "MEDIUM",
      status: "TODO",
      order: 1,
      storyPoints: 5,
      projectId: project.id,
      sprintId: sprint2.id,
      assigneeId: david.id,
      reporterId: sarah.id,
    },
  });

  const task5 = await prisma.issue.create({
    data: {
      key: "APOLLO-7",
      title: "Sanitize Markdown input before rendering comments",
      description: "Prevent potential XSS injection vectors in user-generated markdown comments by running DOMPurify.",
      type: "BUG",
      priority: "HIGH",
      status: "IN_REVIEW",
      order: 0,
      storyPoints: 2,
      projectId: project.id,
      sprintId: sprint2.id,
      assigneeId: alex.id,
      reporterId: marcus.id,
    },
  });

  const task6 = await prisma.issue.create({
    data: {
      key: "APOLLO-8",
      title: "Export audit log records to CSV/JSON format",
      description: "Allow compliance admins to download immutable activity logs for any given sprint or date range.",
      type: "STORY",
      priority: "LOW",
      status: "DONE",
      order: 0,
      storyPoints: 3,
      projectId: project.id,
      sprintId: sprint2.id,
      assigneeId: marcus.id,
      reporterId: alex.id,
    },
  });

  // 6. Create Backlog Issues
  await prisma.issue.createMany({
    data: [
      {
        key: "APOLLO-9",
        title: "Integrate OAuth2 SSO with Okta & Google Workspace",
        description: "Support SAML 2.0 and OIDC identity providers with enterprise domain auto-join.",
        type: "STORY",
        priority: "HIGH",
        status: "BACKLOG",
        order: 0,
        storyPoints: 8,
        projectId: project.id,
        assigneeId: elena.id,
        reporterId: sarah.id,
      },
      {
        key: "APOLLO-10",
        title: "Implement custom notification webhook triggers",
        description: "Allow Slack and Discord notifications on issue assignment and status transition.",
        type: "TASK",
        priority: "MEDIUM",
        status: "BACKLOG",
        order: 1,
        storyPoints: 5,
        projectId: project.id,
        assigneeId: alex.id,
        reporterId: sarah.id,
      },
      {
        key: "APOLLO-11",
        title: "Slow query on historical sprint burndown report",
        description: "Index on `Issue(sprintId, status, updatedAt)` required to reduce p99 from 1800ms to <50ms.",
        type: "BUG",
        priority: "MEDIUM",
        status: "BACKLOG",
        order: 2,
        storyPoints: 3,
        projectId: project.id,
        assigneeId: elena.id,
        reporterId: marcus.id,
      },
    ],
  });

  // 7. Create Comments
  await prisma.comment.create({
    data: {
      content: "I reproduced this in staging with 5,000 concurrent metrics per sec. Running flamegraph profile now.",
      issueId: task2.id,
      authorId: elena.id,
    },
  });

  await prisma.comment.create({
    data: {
      content: "Thanks Elena! Let me know if you need help isolating the gRPC keepalive channel.",
      issueId: task2.id,
      authorId: alex.id,
    },
  });

  await prisma.comment.create({
    data: {
      content: "PR is ready for review. Unit tests pass with 96% coverage on the parser.",
      issueId: task5.id,
      authorId: alex.id,
    },
  });

  // 8. Create Activity Logs
  await prisma.activityLog.createMany({
    data: [
      {
        issueId: task1.id,
        userId: alex.id,
        action: "STATUS_CHANGED",
        field: "status",
        oldValue: "TODO",
        newValue: "IN_PROGRESS",
      },
      {
        issueId: task5.id,
        userId: alex.id,
        action: "STATUS_CHANGED",
        field: "status",
        oldValue: "IN_PROGRESS",
        newValue: "IN_REVIEW",
      },
      {
        issueId: task6.id,
        userId: marcus.id,
        action: "STATUS_CHANGED",
        field: "status",
        oldValue: "IN_REVIEW",
        newValue: "DONE",
      },
    ],
  });

  // 8.1 Create Second Project: Voyager Mobile App (VOY)
  const voyProject = await prisma.project.create({
    data: {
      name: "Voyager Mobile App",
      key: "VOY",
      description: "Cross-platform mobile client built with React Native and Expo.",
      leadId: david.id,
    },
  });
  await seedDefaultWorkflow(prisma, voyProject.id);

  const voySprint1 = await prisma.sprint.create({
    data: {
      name: "Sprint 1 - v1.0 Mobile MVP",
      goal: "Launch iOS TestFlight build with biometric auth.",
      status: "ACTIVE",
      startDate: now,
      endDate: nextTwoWeeks,
      projectId: voyProject.id,
    },
  });

  const voySprint2 = await prisma.sprint.create({
    data: {
      name: "Sprint 2 - Push Notifications & Widgets",
      goal: "APNs / FCM integration and iOS Lock Screen widgets.",
      status: "FUTURE",
      startDate: futureStart,
      endDate: futureEnd,
      projectId: voyProject.id,
    },
  });

  await prisma.issue.createMany({
    data: [
      {
        key: "VOY-1",
        title: "Biometric FaceID & TouchID authentication",
        description: "Integrate Expo LocalAuthentication API with fallback to app PIN code.",
        type: "STORY",
        priority: "HIGH",
        status: "IN_PROGRESS",
        order: 0,
        storyPoints: 5,
        projectId: voyProject.id,
        sprintId: voySprint1.id,
        assigneeId: david.id,
        reporterId: sarah.id,
      },
      {
        key: "VOY-2",
        title: "Crash on Android 14 when resuming from background",
        description: "Null pointer exception in TurboModule registry on deep link resume.",
        type: "BUG",
        priority: "HIGHEST",
        status: "TODO",
        order: 1,
        storyPoints: 8,
        projectId: voyProject.id,
        sprintId: voySprint1.id,
        assigneeId: alex.id,
        reporterId: marcus.id,
      },
      {
        key: "VOY-3",
        title: "Haptic feedback for pull-to-refresh gestures",
        description: "Trigger light impact vibration when user reaches pull threshold.",
        type: "TASK",
        priority: "LOW",
        status: "DONE",
        order: 0,
        storyPoints: 2,
        projectId: voyProject.id,
        sprintId: voySprint1.id,
        assigneeId: david.id,
        reporterId: sarah.id,
      },
      {
        key: "VOY-4",
        title: "Dark mode theme flicker on cold startup",
        description: "Splash screen renders in white before system color-scheme is resolved.",
        type: "BUG",
        priority: "MEDIUM",
        status: "BACKLOG",
        order: 0,
        storyPoints: 3,
        projectId: voyProject.id,
        assigneeId: david.id,
        reporterId: marcus.id,
      },
    ],
  });

  // 8.2 Create Third Project: Orion Data Platform (ORION)
  const orionProject = await prisma.project.create({
    data: {
      name: "Orion Data Platform",
      key: "ORION",
      description: "Distributed analytics query engine and ClickHouse ETL pipeline.",
      leadId: elena.id,
    },
  });
  await seedDefaultWorkflow(prisma, orionProject.id);

  const orionSprint1 = await prisma.sprint.create({
    data: {
      name: "Sprint 1 - Ingestion Pipeline",
      goal: "Set up Kafka-to-ClickHouse ingestion with schema validation.",
      status: "ACTIVE",
      startDate: now,
      endDate: nextTwoWeeks,
      projectId: orionProject.id,
    },
  });

  await prisma.issue.createMany({
    data: [
      {
        key: "ORION-1",
        title: "Partition daily telemetry tables by tenant_id",
        description: "Optimize query prune paths by incorporating tenant UUID into partition keys.",
        type: "TASK",
        priority: "HIGH",
        status: "IN_PROGRESS",
        order: 0,
        storyPoints: 5,
        projectId: orionProject.id,
        sprintId: orionSprint1.id,
        assigneeId: elena.id,
        reporterId: alex.id,
      },
      {
        key: "ORION-2",
        title: "Build automated aggregate rollups for 30-day queries",
        description: "Reduce dashboard load times by pre-computing daily aggregate tables.",
        type: "STORY",
        priority: "MEDIUM",
        status: "TODO",
        order: 1,
        storyPoints: 8,
        projectId: orionProject.id,
        sprintId: orionSprint1.id,
        assigneeId: elena.id,
        reporterId: sarah.id,
      },
      {
        key: "ORION-3",
        title: "Backfill historical Q2 event partitions",
        description: "Run batch migration script for April-June telemetry snapshots.",
        type: "TASK",
        priority: "LOW",
        status: "DONE",
        order: 0,
        storyPoints: 3,
        projectId: orionProject.id,
        sprintId: orionSprint1.id,
        assigneeId: marcus.id,
        reporterId: elena.id,
      },
    ],
  });

  // 9. Create Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: alex.id,
        title: "New comment on APOLLO-4",
        message: "Elena Rostova: I reproduced this in staging with 5,000 concurrent metrics per sec.",
        link: `/projects/${project.key}/board`,
        read: false,
      },
      {
        userId: alex.id,
        title: "Assigned to APOLLO-7",
        message: "Marcus Vance assigned you to 'Sanitize Markdown input before rendering comments'",
        link: `/projects/${project.key}/board`,
        read: false,
      },
      {
        userId: david.id,
        title: "Assigned to APOLLO-3",
        message: "Alex Chen assigned you to 'Configure WebSocket connection fallback to SSE'",
        link: `/projects/${project.key}/board`,
        read: false,
      },
      {
        userId: elena.id,
        title: "High Priority Bug Assigned",
        message: "APOLLO-4: Memory leak in Prometheus exporter under high concurrency",
        link: `/projects/${project.key}/board`,
        read: false,
      },
      {
        userId: sarah.id,
        title: "Sprint 2 Goal Progress",
        message: "APOLLO-8 has been completed and moved to Done.",
        link: `/projects/${project.key}/board`,
        read: true,
      },
    ],
  });

  // Explicit project membership. Access is membership-driven, so seeded
  // projects carry their own member rows rather than relying on a backfill.
  const allUsers = [alex, sarah, david, elena, marcus];

  for (const proj of [project, voyProject, orionProject]) {
    await prisma.projectMember.createMany({
      data: allUsers.map((user) => ({
        projectId: proj.id,
        userId: user.id,
        role:
          user.id === proj.leadId
            ? "ADMIN"
            : user.id === marcus.id
            ? "VIEWER" // QA stakeholder: read-only, to exercise the role
            : "MEMBER",
      })),
    });
  }

  console.log("Seeding completed successfully!");
  console.log(`Demo accounts share the password: ${SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
