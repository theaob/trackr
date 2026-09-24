import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// axe-core against the pages every install sees first: setup, sign-in and
// Projects. Serious and critical findings fail the run; the rest are listed.
// One browser page walks a fresh install through setup, so the steps share it.

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoSeriousViolations(page: Page, name: string, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (include) builder.include(include);
  const results = await builder.analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const report = (list: typeof results.violations) =>
    list
      .map(
        (v) =>
          `[${v.impact}] ${v.id}: ${v.help}\n` +
          v.nodes
            .slice(0, 8)
            .map((n) => `    ${n.target.join(" ")}  ${n.any[0]?.message ?? n.failureSummary?.split("\n")[1] ?? ""}`.trimEnd())
            .join("\n")
      )
      .join("\n");
  const minor = results.violations.filter((v) => !blocking.includes(v));
  if (minor.length) console.log(`${name}: ${minor.length} minor finding(s)\n${report(minor)}`);
  // Soft, so one run reports every page rather than stopping at the first.
  expect.soft(report(blocking), `${name} has serious accessibility problems`).toBe("");
}

test.describe.serial("accessibility", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }, testInfo) => {
    context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("setup", async () => {
    await page.goto("/setup");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
    await expectNoSeriousViolations(page, "Setup");

    await page.getByLabel("Full name").fill("Ada Lovelace");
    await page.getByLabel("Email address").fill("ada@example.com");
    await page.getByLabel("Password").fill("correct horse battery");
    await page.getByLabel("Project name").fill("Apollo");
    await page.getByLabel("Project key").fill("APOLLO");
    await page.getByRole("button", { name: "Complete setup" }).click();
    await page.waitForURL(/\/projects/);
  });

  test("projects", async () => {
    await page.goto("/projects");
    await expect(page.getByRole("link", { name: /Apollo/ }).first()).toBeVisible();
    await expectNoSeriousViolations(page, "Projects");
  });

  test("new layout: Home, Inbox and a project page", async () => {
    await page.goto("/projects");
    await page.getByRole("button", { name: /Ada Lovelace/ }).first().click();
    await page.getByRole("button", { name: "Try the new layout" }).click();
    await page.waitForURL(/\/home/);
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assigned to you" })).toBeVisible();
    await expectNoSeriousViolations(page, "Home");

    await page.getByRole("link", { name: /^Inbox/ }).click();
    await page.waitForURL(/\/inbox/);
    await expect(page.getByText(/Your inbox is empty|Mark all as read/).first()).toBeVisible();
    await expectNoSeriousViolations(page, "Inbox");

    await page.goto("/projects");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
    await expectNoSeriousViolations(page, "Projects (new layout)");

    // Back to classic, so a re-run starts from the same place.
    await page.getByRole("button", { name: /Ada Lovelace/ }).click();
    // Switching reloads the page; wait for it so the next test starts clean.
    await Promise.all([page.waitForEvent("framenavigated"), page.getByRole("menuitem", { name: "Use the classic layout" }).click()]);
    await page.waitForLoadState("load");
  });

  test("an issue: its page, the side panel and an old link", async () => {
    await page.goto("/projects/APOLLO/backlog");
    await page.keyboard.press("c");
    await page.getByPlaceholder("What needs to be done?").fill("Check the issue view");
    await page.locator("form").getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByText("Check the issue view").filter({ visible: true }).first()).toBeVisible();

    await page.goto("/projects/APOLLO/issues/APOLLO-1");
    await expect(page.getByRole("heading", { level: 1, name: "Check the issue view" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Status" })).toBeVisible();
    await expectNoSeriousViolations(page, "Issue page");

    // S opens the status picker from anywhere on the page.
    await page.getByRole("heading", { level: 1, name: "Check the issue view" }).focus();
    await page.keyboard.press("s");
    await expect(page.getByRole("listbox")).toBeVisible();
    await expectNoSeriousViolations(page, "Issue page, status picker open");
    await page.keyboard.press("Escape");

    // Links from before issues had their own page land on it.
    await page.goto("/projects/APOLLO/board?selectedIssue=APOLLO-1");
    await page.waitForURL(/\/projects\/APOLLO\/issues\/APOLLO-1$/);

    await page.goto("/projects/APOLLO/backlog");
    await page.getByText("Check the issue view").filter({ visible: true }).first().click();
    const panel = page.getByRole("dialog", { name: /APOLLO-1/ });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Check the issue view", exact: true })).toBeVisible();
    // Just the panel: the backlog behind it isn't covered yet (its redesign is Phase 3).
    await expectNoSeriousViolations(page, "Issue panel", "[role=dialog]");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });

  test("sign-in", async ({ browser }, testInfo) => {
    const signedOutContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    const signedOut = await signedOutContext.newPage();
    await signedOut.goto("/login");
    await expect(signedOut.getByLabel("Password")).toBeVisible();
    await expectNoSeriousViolations(signedOut, "Sign-in");
    await signedOutContext.close();
  });
});
