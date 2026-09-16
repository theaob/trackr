import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding custom fields for projects...");

  const apollo = await prisma.project.findUnique({ where: { key: "APOLLO" } });
  const voy = await prisma.project.findUnique({ where: { key: "VOY" } });

  if (apollo) {
    console.log(`Configuring custom fields for ${apollo.name} (${apollo.key})...`);
    
    // Check if fields already exist
    const existing = await prisma.customField.findMany({ where: { projectId: apollo.id } });
    if (existing.length === 0) {
      await prisma.customField.createMany({
        data: [
          {
            projectId: apollo.id,
            name: "Environment",
            description: "Deployment target environment affected by or targeted for this issue",
            type: "SELECT",
            options: JSON.stringify(["Production", "Staging", "QA", "Development"]),
            required: false,
          },
          {
            projectId: apollo.id,
            name: "Customer Impact",
            description: "Severity of business impact on client accounts",
            type: "SELECT",
            options: JSON.stringify(["Critical Enterprise", "Tier 1 Accounts", "Minor / Internal", "None"]),
            required: false,
          },
          {
            projectId: apollo.id,
            name: "Is Security Related",
            description: "Indicates whether this issue addresses a vulnerability or security risk",
            type: "CHECKBOX",
            options: null,
            required: false,
          },
          {
            projectId: apollo.id,
            name: "Documentation Link",
            description: "URL to specification, PR, or architecture doc",
            type: "URL",
            options: null,
            required: false,
          },
          {
            projectId: apollo.id,
            name: "Estimated Dev Hours",
            description: "Engineers estimate in direct hours",
            type: "NUMBER",
            options: null,
            required: false,
          },
        ],
      });
      console.log("Created 5 custom fields for APOLLO");
    } else {
      console.log(`APOLLO already has ${existing.length} custom fields.`);
    }

    // Populate a sample value for the first 3 issues of Apollo
    const apolloIssues = await prisma.issue.findMany({
      where: { projectId: apollo.id },
      take: 3,
      orderBy: { key: "asc" },
    });

    const envField = await prisma.customField.findFirst({
      where: { projectId: apollo.id, name: "Environment" },
    });

    if (envField && apolloIssues.length > 0) {
      for (const issue of apolloIssues) {
        await prisma.customFieldValue.upsert({
          where: {
            issueId_customFieldId: {
              issueId: issue.id,
              customFieldId: envField.id,
            },
          },
          update: { value: "Production" },
          create: {
            issueId: issue.id,
            customFieldId: envField.id,
            value: "Production",
          },
        });
      }
      console.log(`Attached sample Environment="Production" to first ${apolloIssues.length} issues`);
    }
  }

  if (voy) {
    console.log(`Configuring custom fields for ${voy.name} (${voy.key})...`);
    const existing = await prisma.customField.findMany({ where: { projectId: voy.id } });
    if (existing.length === 0) {
      await prisma.customField.createMany({
        data: [
          {
            projectId: voy.id,
            name: "Affected Platforms",
            description: "Platforms or clients where issue is reproducible",
            type: "MULTI_SELECT",
            options: JSON.stringify(["Chrome", "Firefox", "Safari", "Edge", "Mobile iOS", "Mobile Android"]),
            required: false,
          },
          {
            projectId: voy.id,
            name: "Design Review Status",
            description: "UX review signoff state",
            type: "SELECT",
            options: JSON.stringify(["Pending Review", "Approved", "Changes Requested"]),
            required: false,
          },
          {
            projectId: voy.id,
            name: "Target Milestone Date",
            description: "Target deadline for QA verification",
            type: "DATE",
            options: null,
            required: false,
          },
        ],
      });
      console.log("Created 3 custom fields for VOY");
    } else {
      console.log(`VOY already has ${existing.length} custom fields.`);
    }
  }

  console.log("Custom fields seeding completed!");
}

main()
  .catch((e) => {
    console.error("Error seeding custom fields:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
