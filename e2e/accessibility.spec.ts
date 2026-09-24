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
    // Menus and dialogs fade in; with reduced motion the app skips that, so
    // axe never catches one half transparent and reports contrast the
    // finished page doesn't have.
    context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, reducedMotion: "reduce" });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("setup", async () => {
    await page.goto("/setup");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
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

  test("backlog and board: plan, start and move with menus", async () => {
    await page.goto("/projects/APOLLO/backlog");
    await expect(page.getByRole("heading", { level: 1, name: "Backlog" })).toBeVisible();
    await expectNoSeriousViolations(page, "Backlog");

    await page.getByRole("button", { name: "Create sprint" }).click();
    const sprint = page.getByRole("region", { name: "Sprint 1" });
    await expect(sprint).toBeVisible();

    // Plan the issue with its row menu rather than by dragging.
    await page.getByRole("button", { name: "Actions for APOLLO-1" }).click();
    await page.getByRole("menuitem", { name: "Sprint 1" }).click();
    await expect(sprint.getByText("Check the issue view")).toBeVisible();

    await sprint.getByRole("button", { name: "Start sprint" }).click();
    const start = page.getByRole("dialog", { name: "Start Sprint 1" });
    await expect(start).toBeVisible();
    await expectNoSeriousViolations(page, "Start sprint dialog", "[role=dialog]");
    await start.getByRole("button", { name: "Start sprint" }).click();
    await expect(start).toBeHidden();

    await page.goto("/projects/APOLLO/board");
    await expect(page.getByRole("heading", { level: 1, name: "Sprint 1" })).toBeVisible();
    const card = (column: string) => page.getByRole("region", { name: column }).getByRole("button", { name: /^APOLLO-1:/ });
    await expect(card("To Do")).toBeVisible();
    await expectNoSeriousViolations(page, "Board");

    // Moving a card never needs dragging: its menu offers the columns the workflow allows.
    await page.getByRole("button", { name: "Actions for APOLLO-1" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await expectNoSeriousViolations(page, "Board, card menu open");
    await page.getByRole("menuitem", { name: "In Progress" }).click();
    await expect(card("In Progress")).toBeVisible();
    await page.reload();
    await expect(card("In Progress")).toBeVisible();

    // The keyboard: Space lifts the card, an arrow moves it, Space drops it.
    await card("In Progress").focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
    await page.keyboard.press("Space");
    await expect(card("In Review")).toBeVisible();

    // And the mouse.
    const from = await card("In Review").boundingBox();
    const to = await page.getByRole("region", { name: "Done" }).boundingBox();
    if (!from || !to) throw new Error("board not laid out");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    for (let step = 1; step <= 12; step++) {
      await page.mouse.move(from.x + ((to.x + to.width / 2 - from.x) * step) / 12, from.y + from.height / 2 + step, { steps: 2 });
    }
    await page.mouse.up();
    await expect(card("Done")).toBeVisible();
    await page.reload();
    await expect(card("Done")).toBeVisible();
  });

  test("issues: views, chips, TQL and a saved view", async () => {
    await page.goto("/projects/APOLLO/issues");
    await expect(page.getByRole("heading", { level: 1, name: "Issues" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Issues" }).getByText("Check the issue view")).toBeVisible();
    await expectNoSeriousViolations(page, "Issues, split");

    await page.getByRole("button", { name: "Table" }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await expectNoSeriousViolations(page, "Issues, table");

    // Every old preset is a view.
    await page.getByRole("button", { name: /choose a view/ }).click();
    for (const name of ["All issues", "My open issues", "Reported by me", "Recently updated", "Done", "High priority"]) {
      await expect(page.getByRole("menuitemcheckbox", { name })).toBeVisible();
    }
    await expectNoSeriousViolations(page, "Issues, views menu");
    await page.getByRole("menuitemcheckbox", { name: "Reported by me" }).click();
    await expect(page).toHaveURL(/view=preset-reported/);
    await expect(page.getByRole("table").getByText("Check the issue view")).toBeVisible();

    // A chip writes TQL, and the TQL reads back into chips.
    const filters = page.getByRole("group", { name: "Filters" });
    await filters.getByRole("button", { name: /^Type/ }).click();
    await page.getByRole("menuitemcheckbox", { name: "Bug" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText("No issues match these filters.")).toBeVisible();
    await filters.getByRole("button", { name: "Edit as TQL" }).click();
    const tql = page.getByRole("combobox", { name: "TQL query" });
    await expect(tql).toHaveValue(/type = "BUG"/);
    await expectNoSeriousViolations(page, "Issues, TQL");
    await tql.fill('project = "APOLLO" AND reporter = currentUser() ORDER BY created DESC');
    await tql.press("Enter");
    await expect(page.getByRole("table").getByText("Check the issue view")).toBeVisible();
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(filters.getByRole("button", { name: "Reporter: Me" })).toBeVisible();

    // Save it as a view of your own; it's there after a reload.
    await page.getByRole("button", { name: /choose a view/ }).click();
    await page.getByRole("menuitem", { name: "Save as a new view…" }).click();
    const dialog = page.getByRole("dialog", { name: "Save as a new view" });
    await dialog.getByLabel("Name").fill("Mine, newest first");
    await expectNoSeriousViolations(page, "Save view dialog", "[role=dialog]");
    await dialog.getByRole("button", { name: "Save view" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/view=/);
    await page.reload();
    await expect(page.getByRole("button", { name: /Mine, newest first/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Issues" }).getByText("Check the issue view")).toBeVisible();
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
