import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// axe-core against the pages every install sees first: setup, sign-in and
// Projects. Serious and critical findings fail the run; the rest are listed.
// One browser page walks a fresh install through setup, so the steps share it.

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function checkWithAxe(page: Page, name: string, include?: string) {
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

/** Switches the page's theme the way the account menu does, without a reload. */
async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    localStorage.setItem("tamam:theme", t);
    window.dispatchEvent(new Event("tamam:appearance"));
  }, theme);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

/** Every check runs in the light theme and again in the dark one. */
async function expectNoSeriousViolations(page: Page, name: string, include?: string) {
  // A whole page has one main heading: the page's own, or the breadcrumb's where it has none.
  if (!include) expect.soft(await page.locator("h1").count(), `${name} should have one h1`).toBe(1);
  await checkWithAxe(page, name, include);
  await setTheme(page, "dark");
  await checkWithAxe(page, `${name} (dark)`, include);
  await setTheme(page, "light");
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

  test("Home, Inbox and the shell around a page", async () => {
    // Signed-in people land on Home.
    await page.goto("/");
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
    await expectNoSeriousViolations(page, "Projects in the shell");

    // The account dialogs and the shortcuts list.
    await page.getByRole("button", { name: /Ada Lovelace/ }).click();
    await page.getByRole("menuitem", { name: /Password/ }).click();
    // With reduced motion, dialogs appear without fading in (so axe never sees one half drawn).
    expect(await page.getByRole("dialog").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    await expectNoSeriousViolations(page, "Password and sessions dialog", "[role=dialog]");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Ada Lovelace/ }).click();
    await page.getByRole("menuitem", { name: /access tokens/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: "New token" }).click();
    await expect(page.getByRole("dialog", { name: "New personal access token" })).toBeVisible();
    await expectNoSeriousViolations(page, "New token dialog", "[role=dialog]");
    await page.keyboard.press("Escape");
    await page.locator("body").press("?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await expectNoSeriousViolations(page, "Keyboard shortcuts dialog", "[role=dialog]");
    await page.keyboard.press("Escape");
  });

  test("an issue: its page, the side panel and an old link", async () => {
    await page.goto("/projects/APOLLO/backlog");
    await page.keyboard.press("c");
    const create = page.getByRole("dialog", { name: "Create issue" });
    await create.getByRole("textbox", { name: "Title" }).fill("Check the issue view");
    await expectNoSeriousViolations(page, "Create issue dialog", "[role=dialog]");
    await create.getByRole("button", { name: "Create", exact: true }).click();
    await expect(create).toBeHidden();
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

  test("appearance and phones: the account menu, the tab bar, the first card", async () => {
    await page.goto("/home");

    // Theme and density from the account menu apply at once, without a reload.
    await page.getByRole("button", { name: /Ada Lovelace/ }).click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    // Compact is the default until someone picks Comfortable.
    await expect(page.getByRole("menuitemradio", { name: "Compact" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("menuitemradio", { name: "Comfortable" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-density", "comfortable");
    await expectNoSeriousViolations(page, "Account menu");
    await page.getByRole("menuitemradio", { name: "Compact" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
    await page.getByRole("menuitemradio", { name: "Match system" }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // A 390-pixel phone: the rail is a tab bar and the first card shows without scrolling.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/home");
    const assigned = page.getByRole("region", { name: "Assigned to you" });
    await expect(assigned).toBeVisible();
    // Nothing runs off the side of the phone.
    expect((await assigned.boundingBox())!.x + (await assigned.boundingBox())!.width).toBeLessThanOrEqual(390);
    await expectNoSeriousViolations(page, "Home (phone)");

    await page.goto("/projects/APOLLO/board");
    const tabs = page.getByRole("navigation", { name: "Main" });
    await expect(tabs.getByRole("link", { name: "Board" })).toHaveAttribute("aria-current", "page");
    const firstCard = page.locator('[data-rfd-draggable-id]').first();
    await expect(firstCard).toBeVisible();
    const box = await firstCard.boundingBox();
    const bar = await tabs.boundingBox();
    expect(box && bar && box.y + box.height <= bar.y).toBe(true);
    await expectNoSeriousViolations(page, "Board (phone)");

    await page.goto("/projects/APOLLO/issues/APOLLO-1");
    const chips = page.getByRole("group", { name: "Main properties" });
    await expect(chips).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Properties" })).toBeHidden();
    await expectNoSeriousViolations(page, "Issue (phone)");
    await chips.getByRole("button", { name: /^Status:/ }).click();
    await expect(page.getByRole("complementary", { name: "Properties" })).toBeVisible();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");

    await tabs.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
    await expectNoSeriousViolations(page, "Navigation sheet (phone)");
    await page.keyboard.press("Escape");

    // Back to a desktop for the tests after this one.
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("reports, roadmap and releases", async () => {
    await page.goto("/projects/APOLLO/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Burndown and burnup" })).toBeVisible();
    await expectNoSeriousViolations(page, "Reports, overview");
    await page.getByRole("tab", { name: "Velocity" }).click();
    await page.getByRole("button", { name: "Table" }).click();
    await expect(page.getByRole("region", { name: /Velocity by sprint/ })).toBeVisible();
    await expectNoSeriousViolations(page, "Reports, velocity as a table");
    for (const [tab, heading] of [
      ["Cumulative flow", "Cumulative flow"],
      ["Distribution", "Distribution"],
      ["Epic progress", "Epic progress"],
    ]) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expectNoSeriousViolations(page, `Reports, ${tab.toLowerCase()}`);
    }

    await page.goto("/projects/APOLLO/roadmap");
    await expect(page.getByRole("heading", { level: 1, name: "Roadmap" })).toBeVisible();
    await expectNoSeriousViolations(page, "Roadmap");

    // ⌘K's "Create release" goes to Releases with the dialog open.
    await page.keyboard.press("ControlOrMeta+k");
    const search = page.getByRole("dialog", { name: "Search issues, pages and projects" });
    await search.getByRole("combobox").fill("create release");
    await search.getByRole("option", { name: /Create release/ }).click();
    await page.waitForURL(/\/projects\/APOLLO\/releases/);
    const create = page.getByRole("dialog", { name: "Create version" });
    await expect(create).toBeVisible();
    await create.getByLabel("Name").fill("1.0");
    await expectNoSeriousViolations(page, "Create version dialog", "[role=dialog]");
    await create.getByRole("button", { name: "Create version" }).click();
    await expect(create).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Releases" })).toBeVisible();
    await expect(page).not.toHaveURL(/create=1/);
    await expect(page.getByRole("cell", { name: "1.0", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Show the issues in 1.0" }).click();
    await expectNoSeriousViolations(page, "Releases");
    await page.getByRole("button", { name: "More actions for 1.0" }).click();
    await expect(page.getByRole("menuitem", { name: "Release notes" })).toBeVisible();
    await expectNoSeriousViolations(page, "Releases, version menu");
    await page.keyboard.press("Escape");
  });

  test("settings: every section, and the save bar", async ({ browser }, testInfo) => {
    // About thirty axe runs (every section and dialog, in both themes): more than the default 30 s.
    test.setTimeout(90_000);
    // A second person signs up, so Add member has someone to add.
    const otherContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL, reducedMotion: "reduce" });
    const other = await otherContext.newPage();
    await other.goto("/login");
    await other.getByRole("button", { name: "Create account" }).click();
    await other.getByLabel("Full name").fill("Grace Hopper");
    await other.getByLabel("Email").fill("grace@example.com");
    await other.getByLabel("Password").fill("another long password");
    await other.locator("form").getByRole("button", { name: "Create account" }).click();
    await other.waitForURL((url) => !url.pathname.startsWith("/login"));
    await otherContext.close();

    await page.goto("/projects/APOLLO/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Project settings" })).toBeVisible();
    await expectNoSeriousViolations(page, "Settings, details");
    await page.getByLabel("Name").fill("Apollo renamed");
    const bar = page.getByRole("region", { name: "Unsaved changes" });
    await expect(bar).toBeVisible();
    await expectNoSeriousViolations(page, "Settings, unsaved changes");
    await bar.getByRole("button", { name: "Discard" }).click();
    await expect(bar).toBeHidden();
    await expect(page.getByLabel("Name")).toHaveValue("Apollo");

    const nav = page.getByRole("navigation", { name: "Project settings" });
    // Each section, and the dialog it opens.
    const dialogs: Record<string, [string, string]> = {
      Components: ["Create component", "Create component"],
      "Custom fields": ["Create custom field", "Create custom field"],
      Members: ["Add member", "Add a member"],
      Roles: ["Create role", "Create role"],
      Webhooks: ["Create webhook", "Create webhook"],
    };
    for (const section of ["Components", "Custom fields", "Members", "Roles", "Visibility", "Workflow", "Webhooks"]) {
      await nav.getByRole("button", { name: new RegExp(`^${section}`) }).click();
      await expect(page.getByRole("heading", { level: 2, name: section, exact: true })).toBeVisible();
      await expectNoSeriousViolations(page, `Settings, ${section.toLowerCase()}`);
      const opens = dialogs[section];
      if (!opens) continue;
      await page.getByRole("button", { name: opens[0], exact: true }).first().click();
      const dialog = page.getByRole("dialog", { name: opens[1] });
      await expect(dialog).toBeVisible();
      await expectNoSeriousViolations(page, `${opens[1]} dialog`, "[role=dialog]");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
    await nav.getByRole("button", { name: /^Roles/ }).click();
    await page.getByRole("button", { name: "Compare permissions" }).click();
    await expectNoSeriousViolations(page, "Permissions by role dialog", "[role=dialog]");
    await page.keyboard.press("Escape");
    await nav.getByRole("button", { name: /^Webhooks/ }).click();
    await expect(page).toHaveURL(/section=webhooks/);

    await nav.getByRole("button", { name: /^Workflow/ }).click();
    await page.getByRole("button", { name: /^Colour of TODO/ }).click();
    await expect(page.getByRole("group", { name: "Colour of TODO" })).toBeVisible();
    await expectNoSeriousViolations(page, "Settings, status colours");
    await page.keyboard.press("Escape");

    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1, name: "System settings" })).toBeVisible();
    const system = page.getByRole("navigation", { name: "System settings" });
    for (const section of ["Users", "Single sign-on", "About this install"]) {
      await system.getByRole("button", { name: section }).click();
      await expect(page.getByRole("heading", { level: 2, name: section, exact: true })).toBeVisible();
      await expectNoSeriousViolations(page, `System settings, ${section.toLowerCase()}`);
    }
  });

  test("sign-in", async ({ browser }, testInfo) => {
    const signedOutContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    const signedOut = await signedOutContext.newPage();
    await signedOut.goto("/login");
    await expect(signedOut.getByLabel("Password")).toBeVisible();
    await expectNoSeriousViolations(signedOut, "Sign-in");

    // A public project, as someone who isn't signed in: the same shell, with Sign in in place of Home and Inbox.
    await page.goto("/projects/APOLLO/settings?section=visibility");
    await page.getByRole("checkbox", { name: /Anyone with the link/ }).check();
    const bar = page.getByRole("region", { name: "Unsaved changes" });
    await bar.getByRole("button", { name: "Save changes" }).click();
    await expect(bar).toBeHidden();

    await signedOut.goto("/projects/APOLLO/board");
    const rail = signedOut.getByRole("navigation", { name: "Main" }).first();
    await expect(signedOut.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
    await expect(rail.getByRole("link", { name: "Home" })).toHaveCount(0);
    await expectNoSeriousViolations(signedOut, "Public board, signed out");
    await signedOut.setViewportSize({ width: 390, height: 844 });
    const tabs = signedOut.getByRole("navigation", { name: "Main" }).last();
    await expect(tabs.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Board" })).toHaveAttribute("aria-current", "page");
    await signedOutContext.close();
  });
});
