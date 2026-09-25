# Tamam

*Formerly Trackr.* Tamam is Turkish for "done". A modern, full-stack agile project management and issue tracking platform built with **Next.js 15**, **React 19**, **TypeScript**, **Tailwind CSS**, and **SQLite with Prisma ORM**.

---

## ✨ Features

- 📋 **Board**:
  - One column per workflow status, sharing the width equally: four fit on a
    1280-pixel screen, and only boards with more statuses scroll. On a phone,
    one full-width column at a time: swipe or use the status switcher, and the
    sprint header folds to one line so the first card shows straight away.
  - A one-line sprint header: name, dates, days left and a progress bar split
    into done, in progress and to do, with the goal underneath.
  - Move a card by dragging it, with the keyboard (Space to lift, arrows,
    Space to drop), or from its **…** menu, which lists the columns the
    workflow allows plus top and bottom of its own column.
  - Filter chips for people, type and priority, each removable, and
    **+ Filter** to carry on in the Issues page with TQL. Group rows by
    assignee, epic or priority.
  - Kanban WIP limits show in the column header as `3 / 4`, amber at the
    limit and red over it.
- 🔎 **Search everything with ⌘K** (Ctrl+K on Windows and Linux):
  - A Spotlight-style panel that finds issues by key or title across every project
    you can see, any page of any project ("orion backlog", "burndown"), and the
    projects themselves.
  - **People** on your project teams, by name: choosing one opens the issues
    assigned to them. Comment text isn't searched.
  - **Create issue** and **Create release** (which opens Releases with the new
    version dialog) are there as actions.
  - Type `APOLLO-12`, or just `12` inside Apollo, to jump straight to an issue.
  - Arrow keys to move, Enter to open, ⌘/Ctrl+Enter for a new tab. `/` still
    filters the board, backlog and issue list in place.
- 🧭 **Layout**:
  - A rail on the left holds search, Home, Inbox and every project you're on,
    with the current one's pages opened out. `[` collapses it to icons.
  - **Home** shows open issues assigned to you, what's due or overdue this
    week, issues you opened recently (kept in your browser only), and your
    projects. It's where you land after signing in.
  - **Inbox** lists every notification by day, with All/Unread and
    mark-as-read; the bell stays as a quick preview. Every @mention of you
    arrives there, in a comment (including when a comment is edited to add
    you) or a description, whether or not you watch the issue.
  - In ⌘K search, an empty query shows recently viewed issues, and `→` on an
    issue opens its actions: open, assign to me, move to any status the
    workflow allows, copy the link.
  - On a phone the rail becomes a tab bar along the bottom (Home, Board,
    Issues, Inbox, More). An issue opens full-screen with its main properties
    as a row of chips, the comment box stays pinned to the bottom, and a
    sideways swipe steps to the previous or next issue.
  - `g h` goes to Home and `g n` to the Inbox.
  - Visitors to a public project who aren't signed in get the same layout,
    with **Sign in** in place of Home and Inbox.
- 🌓 **Theme and density**, in the account menu:
  - **Light**, **Dark** or **Match system**. Every colour comes from theme
    tokens, and the page is drawn in the right theme from the first paint.
  - **Compact** (the default) or **Comfortable**: Compact takes padding out of
    table rows, backlog rows, board cards, Home and the Inbox; text stays the
    same size. The Issues table's density button changes the same setting.
  - Both are remembered per browser.
- ♿ **Keyboard and screen readers**:
  - Every dialog is labelled, keeps focus inside, closes with Escape and gives
    focus back to whatever opened it. Deleting or revoking something asks in a
    dialog, not a browser pop-up, and failures show as a notice.
  - Icon buttons have names, and their hints appear on keyboard focus as well
    as on hover. Pickers are keyboard-driven lists with search where lists are
    long.
  - With reduced motion turned on in the system, dialogs, menus and pop-overs
    appear without animating.
- 🔁 **Custom Workflows, per project**:
  - Add, rename, reorder (drag, or Move up/down from a status's menu), recolor, or
    delete statuses; the board shows one column per non-backlog status, in the order
    you set, and the settings page draws that flow at the top.
  - Each status opens in a side panel with everything about it: name, colour,
    category, whether it's a board column, its work-in-progress limit, and the
    statuses issues in it can move to and arrive from.
  - Define exactly which status can move to which, per status or in the table of
    allowed moves; it's enforced everywhere a status can change (issue view, board
    drag-and-drop, the REST API) -- not just hidden from a dropdown. A status nothing
    leads to, or one issues can't leave, is flagged in the list.
  - Every project starts with the same five statuses as before (`Backlog`, `To Do`,
    `In Progress`, `In Review`, `Done`), fully interconnected, so nothing changes until
    an administrator edits it in **Project Settings → Workflow**, where each status
    takes its colour from a set of swatches (or any colour you pick).
- 🔀 **Scrum or Kanban, per project**:
  - **Scrum**: plan sprints in the Backlog; the board shows only the active sprint.
  - **Kanban**: no sprints; the board is every issue pulled out of the Backlog, in
    continuous flow. Switch anytime from **Project Settings → Details**.
- 🏃 **Backlog & sprints**:
  - Each sprint is a section with a one-line header (dates, issues, points)
    and one action, **Start sprint** or **Complete sprint**; editing,
    renaming and deleting are in its menu. Open issues roll over when a
    sprint completes.
  - Rows line up like the Issues table, with status lozenges.
  - Select several with the checkboxes, ⌘/Ctrl-click or Shift-click for a
    range, then move them to a sprint or the backlog, or change their
    assignee or priority, all at once.
  - Each row's **…** menu (or a right-click) moves it without dragging.
  - **Create issue** at the foot of a section: type a title, press Enter,
    and the row is ready for the next one.
- 📊 **Reports**: each opens with its headline figure, and every chart has a
  **Table** view with the numbers it draws.
  - **Burndown and burnup** (Scrum): work remaining against the guideline, or
    work done against scope, reconstructed from each issue's status history.
    Leads with the work remaining and how far scope has moved.
  - **Velocity** (Scrum): committed against completed work per sprint. Leads
    with the average and how much of the commitment was delivered.
  - **Cumulative flow**: work in each workflow status over 14, 30 or 90 days.
    Leads with the average lead time, beside throughput and work in progress.
  - **Distribution**: issues or points by status, assignee, type or priority.
  - **Epic progress**: each epic's child issues by status.
  - Chart colours come from the theme's tokens and a palette checked for
    colour blindness.
- 🗺️ **Roadmap**: a timeline of your epics (Scrum or Kanban -- epics aren't
  sprint-bound), each bar spanning its start and due date and filling with
  its issues' progress, with a today line and a hover card. Expand an epic to
  see its issues on the timeline. Epics missing either date are listed
  separately rather than silently dropped.
- 🚀 **Releases**: versions in a table (status, release date, progress), with
  each version's issues a click away. Release, edit, archive and delete from
  the version's menu, and generate release notes.
- 🎯 **Issue Management**:
  - Issue types: **Epic**, **Story**, **Task**, **Bug**, **Sub-task**.
  - Priority levels: **Highest**, **High**, **Medium**, **Low**, **Lowest**.
  - Story points estimate badges and optional due dates, with an overdue
    indicator on cards, list rows, and the issue detail view.
  - Assignee & reporter assignment.
  - Parent Epic linking.
  - Issue linking (**Blocks**, **Relates to**, **Duplicates**), including
    across projects.
  - Free-text labels, created inline on an issue and filterable from the
    Issues list.
  - **Components**: admin-defined sub-teams or subsystems (e.g. "Backend API",
    "Mobile App") with an optional lead, managed in Project Settings. Unlike
    labels, an issue can only pick from the project's existing set -- not
    create a new one on the fly.
  - Bulk actions from the Issues list: select several issues and change their
    status, assignee, priority or fix version, add a label, or delete them
    all at once.
- ➕ **Create an issue** with `c` or **Create**:
  - A title, then the properties most issues need as chips: type, assignee,
    priority and sprint (the active one by default).
  - The description is one click away, and Tab from the title goes straight
    into it. **More fields** has story points, dates, fix version, parent epic
    and custom fields; required custom fields open it by themselves.
  - ⌘/Ctrl+Enter creates. Tick **Create another** to keep the dialog open,
    with the same properties, for the next one.
- 📝 **The issue view**, the same everywhere: in a panel over the board,
  backlog, roadmap and issue table, in the Issues split view, and on the
  issue's own page at `/projects/KEY/issues/KEY-12`, which every link,
  notification and **Open as page** leads to. Older `?selectedIssue=` links
  still work and open that page.
  - Title and description edited in place.
  - Properties as a list; each value opens a searchable picker, with avatars
    for people. Press `a` for the assignee, `s` for the status, `p` for the
    priority and `i` to assign the issue to yourself; `←`/`→` step through
    the list the issue was opened from.
  - Parents, sub-issues and linked issues open in the same panel, with a way
    back. Empty sections are a single line with their action ("Add link").
  - **Markdown support** in descriptions and comments -- headings, bold/italic,
    lists, links, inline code and fenced code blocks, and tables, rendered
    safely with `react-markdown` (no raw HTML pass-through).
  - **File attachments**: drag-and-drop or browse to attach files, with
    thumbnail previews for images. Only a vetted image allow-list is ever
    rendered inline; everything else downloads as an opaque file, regardless
    of what the uploader's browser claimed its type was.
  - **Time tracking**: Original and Remaining estimate fields (Jira's compact
    format, e.g. `2d 4h` -- 1d = 8h, 1w = 5d), a logged/remaining/original
    progress bar, and a work log of individual entries. Logging work
    auto-decrements the remaining estimate; deleting an entry restores it.
  - Status progression, constrained to the project's own workflow.
  - **Watch** an issue you're not assigned to, to get notified on status
    changes and new comments.
  - **Activity**: comments and the change history in one timeline, newest
    first, narrowed to either with **Comments** or **History**; older entries
    load 50 at a time.
- 🔍 **The Issues page**:
  - **Views**: All issues, My open issues, Reported by me, Recently updated,
    Done and High priority are built in. Save your own from the views menu
    (the query and the columns), then update, rename or delete it. Saved
    views are private to you and apply to whichever project you open them in.
    The address bar keeps `?view=` or `?tql=`, so a link opens the same list.
  - **Filter chips** for status, assignee, type and priority, plus reporter,
    sprint, fix version and label from **+ Filter**, and a search box. Every
    chip writes TQL: **Edit as TQL** shows the whole query, and **Filters**
    turns it back into chips. Conditions the chips can't show stay as chips
    of their own.
  - **Table**: choose the columns, sort by clicking a header, and switch to a
    compact density. Priority sorts by rank, Highest to Lowest, not
    alphabetically; the High priority view is sorted that way too. **Export CSV** downloads the columns on screen.
  - Select rows for bulk actions in the toolbar: status, assignee, priority,
    fix version, add a label, or delete.
  - **Split view**: the list on the left and the issue on the right.
- 🔐 **Authentication & Access Control**:
  - Email/password sign-in backed by a signed, http-only session cookie.
  - PBKDF2-SHA512 password hashing (210k iterations) with transparent upgrades.
  - Repeated wrong passwords lock that account's sign-in for 15 minutes, and
    instance administrators can turn off account creation from the sign-in page.
  - Anyone can change their password or sign out their other sessions from the
    account menu (**Password & sessions**); either ends every other session.
  - Per-project roles (**Administrator**, **Member**, **Viewer**) enforced on the
    server, not just in the UI.
  - Optional **public projects**: a project can grant read-only access to
    visitors with no account.
  - Optional OIDC single sign-on with real ID token signature verification.
  - Personal access tokens for the REST API, scoped to the owner's projects.
- ⚙️ **Project Settings**: a list of sections down the left: Details,
  Components, Custom fields, Members, Roles, Visibility, Workflow and Webhooks.
  Members and roles are tables edited in place. A section with unsaved changes
  shows a bar to save or discard them. `?section=` in the address opens a
  section directly. **System Settings** has the same layout: Users, Single
  sign-on and About this install.

---

## 🚀 Quick Start

### 1. Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

A database with no accounts boots straight into **setup mode**: you'll be
asked to create the admin account and the first project in one step, and land
on that project's board signed in as its administrator. Setup only runs once
— as soon as one account exists, `/setup` stops working and normal sign-in
takes over.

Want the bundled demo dataset (3 sample projects, 5 fake users) instead of a
blank instance? Seed it explicitly:

```bash
npm run db:seed
```

The demo accounts all share the password **`tamam-demo`** (override at seed
time with `TAMAM_SEED_PASSWORD`):

| Account | Email | Project role |
| --- | --- | --- |
| Alex Chen | `alex.chen@acme.dev` | Administrator (Apollo lead) |
| Sarah Connor | `sarah.c@acme.dev` | Member |
| David Kim | `david.k@acme.dev` | Member (Voyager lead) |
| Elena Rostova | `elena.r@acme.dev` | Member (Orion lead) |
| Marcus Vance | `marcus.v@acme.dev` | Viewer |

> **Change or remove these accounts before exposing an instance to anyone else.**
> Re-seeding **deletes all existing projects, issues and comments** — only run
> it on a throwaway database.

### 2. Production Build
```bash
npm run build
npm start
```

### 3. Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | Prisma SQLite connection string. |
| `AUTH_SECRET` | generated | Signs session cookies; 32+ characters. Generate with `openssl rand -hex 32`. When unset, a random secret is written to `<data dir>/.session-secret` on first use, so sessions survive restarts but not a new volume. |
| `TAMAM_DATA_DIR` | `./data` | Where avatars, issue attachments, and the generated session secret live. |
| `TAMAM_ALLOW_PRIVATE_WEBHOOKS` | `0` | Set to `1` to let webhooks target loopback, link-local and private addresses. Off by default so a webhook cannot be pointed at internal services. The bundled `/api/mock-webhook-receiver` (development only; production builds answer 404) is on localhost, so trying it out needs this set. |
| `TAMAM_TRUST_PROXY` | `0` | Set to `1` only when a reverse proxy in front of Tamam terminates HTTPS and forwards `X-Forwarded-Proto: https`. This marks the session cookie `Secure`, which browsers require for HTTPS but silently reject on plain HTTP from anywhere but `localhost`. Leave unset for a direct `http://` deployment (e.g. `docker run -p 3000:3000` with no proxy) — enabling it there breaks sign-in. It also makes Tamam trust `X-Forwarded-For`, which turns on per-client-address limits for failed sign-ins and API tokens; the per-account sign-in limit applies either way. |
| `TAMAM_SEED_PASSWORD` | `tamam-demo` | Password given to the demo accounts by `db:seed`. |
| `TAMAM_SEED_DEMO` | `0` | Docker only. Set to `1` to boot a fresh container from the seeded demo dataset instead of an empty database + setup wizard. Ignored once a database already exists. |

### 4. Database Management
- **Database Schema Push**: `node ./node_modules/prisma/build/index.js db push`
- **Re-seed Demo Data**: `node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts`
- **Prisma Studio**: `node ./node_modules/prisma/build/index.js studio`

---

## 🐳 Docker Deployment

### Run with Docker Compose (Recommended)
```bash
docker compose up -d
```
Open [http://localhost:3000](http://localhost:3000) and complete the setup wizard
to create the admin account. Data is automatically persisted in the `tamam_data`
volume. Coming from Trackr? Copy the old volume first; see
[Upgrading from Trackr](#️-upgrading-from-trackr).
Prefer the demo dataset instead? Set `TAMAM_SEED_DEMO=1` before the
first start (see the Configuration table above) — it only takes effect while
the database doesn't exist yet.

### Run with Docker CLI
```bash
# Build the image locally
docker build -t tamam:latest .

# Run the container with persistent storage
docker run -d -p 3000:3000 -v tamam_data:/app/data --name tamam tamam:latest
```

### Pull & Run from Docker Hub
```bash
docker run -d -p 3000:3000 -v tamam_data:/app/data --name tamam <DOCKERHUB_USERNAME>/tamam:latest
```

### Pull & Run from GitHub Container Registry (GHCR)
```bash
docker run -d -p 3000:3000 -v tamam_data:/app/data --name tamam ghcr.io/theaob/tamam:latest
```

---

## 🚀 Automated Releases & Docker Hub CI/CD

Whenever the version is bumped in `package.json` and pushed to `main` (or a `v*` tag is pushed), the GitHub Actions workflow ([`.github/workflows/release.yml`](.github/workflows/release.yml)) automatically:
1. Detects the new version and ensures it hasn't been released yet.
2. Creates a formal **GitHub Release** with auto-generated release notes and changelog.
3. Builds a `linux/amd64` Docker image.
4. Pushes the versioned images to **Docker Hub** as `tamam` (`:latest`, `:<version>`, `:<major>.<minor>`), and to **GHCR** as `ghcr.io/<owner>/tamam`.

### Required GitHub Secrets
To enable Docker Hub publishing, add the following secrets in GitHub (**Settings > Secrets and variables > Actions**):
- `DOCKERHUB_USERNAME`: Your Docker Hub username.
- `DOCKERHUB_TOKEN`: Your Docker Hub Personal Access Token.
- `DOCKERHUB_REPO` *(optional)*: The Docker Hub repository to push to. Defaults to `<DOCKERHUB_USERNAME>/tamam`.

### Releasing a New Version
```bash
# Bump version (e.g. 0.1.0 -> 0.1.1 or 0.2.0)
npm version patch   # or minor / major

# Push commit to main (or push tags)
git push origin main
```

## 🌍 Public projects

A project can be opened to people without an account, one project at a time.
In **Project Settings → Visibility**, a project administrator ticks
*"Anyone with the link can view this project, without signing in"*.

Visitors then get the **Viewer** role on that project alone:

- They can read the board, backlog, issues and releases, and change nothing —
  Viewer carries `VIEW_PROJECT` and no other permission, so every write is
  refused by the same table that governs signed-in users.
- Private projects stay invisible; the project directory shows a visitor only
  what is published.
- Email addresses are withheld. Assignees, reporters and comment authors are
  shown by name and avatar only, and the member roster is limited to the
  project's own team.
- The landing page sends a visitor to a published project rather than to the
  sign-in screen. Requesting a private one offers sign-in and returns them to
  where they were headed.

Everything in a published project is readable by anyone with the link, so treat
the switch as publishing.

## ⬆️ Upgrading from a version without authentication

Earlier versions had no server-side authentication, and accounts were created
without a password. Sign-in now fails closed, so **an existing database has no
account that can sign in** until a password is set. The login screen says so
when it detects that state.

Set one from the project directory:

```bash
npm run set-password -- --list                  # which accounts have a password
npm run set-password -- alex.chen@acme.dev      # generate one, printed once; ends their sessions
npm run set-password -- alex.chen@acme.dev 'a good password'
```

Or inside a running container (`tamam-app` with the bundled compose file,
otherwise the name you gave it):

```bash
docker exec -it tamam-app node scripts/set-password.cjs --list
docker exec -it tamam-app node scripts/set-password.cjs alex.chen@acme.dev
```

Re-seeding (`npm run db:seed`) also works, but it **deletes all existing
projects, issues and comments** — use it only on a throwaway database.

A few other changes are worth knowing about when upgrading:

- **Instance settings belong to instance administrators.** SSO, global
  webhooks, system information, and who may create projects used to be open to
  anyone who administered any project. They now require the instance
  administrator flag. On upgrade it's given once, automatically, to the oldest
  account allowed to create projects (the account from `/setup`, or the first
  demo user); that person can grant it to others under **System Settings →
  Users**. There is always at least one.
- **Account creation can be turned off.** Anyone who can reach the sign-in
  page can create an account by default. On an instance exposed to the
  internet, turn this off under **System Settings → Users**; people can still
  join through SSO.
- **Access is membership-driven.** Projects created before memberships existed
  are backfilled once with every user on first load, so nothing disappears, but
  newly registered accounts no longer join every project automatically.
- **Set `AUTH_SECRET`.** Without it, a secret is generated into the data
  directory; replacing that directory signs everyone out.

## ⬆️ Upgrading from Trackr

0.41.0 renamed the product to Tamam and kept the Trackr names working. 0.42.0
removes them, so upgrading from any earlier version is a clean break:

- **Everyone is signed out once.** The session and SSO cookies are now
  `tamam_session` and `tamam_sso_state`.
- **Settings are read only as `TAMAM_*`.** Rename every `TRACKR_*` variable
  (`TRACKR_DATA_DIR`, `TRACKR_TRUST_PROXY`, `TRACKR_ALLOW_PRIVATE_WEBHOOKS`,
  `TRACKR_SEED_DEMO`, `TRACKR_SEED_PASSWORD`); the old names are ignored. A
  non-Docker install that set `TRACKR_DATA_DIR` must set `TAMAM_DATA_DIR` or it
  will look for its avatars, attachments and session secret in `./data`.
- **API tokens starting `trackr_pat_` are refused.** Create new ones from the
  account menu, **Personal access tokens**; they start `tamam_pat_`.
- **Webhooks carry only `X-Tamam-Event` and `X-Tamam-Delivery`.** Receivers
  still reading `X-Trackr-*` must switch first.
- **The Docker image is published only as `tamam`** (`<DOCKERHUB_USERNAME>/tamam`
  and `ghcr.io/theaob/tamam`); the `trackr` images get no further updates.
- **Theme, density, the collapsed rail and recent issues** are remembered under
  new keys, so each browser starts from the defaults once.

### Moving a Docker Compose install

The bundled compose file now names its service `tamam`, its container
`tamam-app` and its volume `tamam_data`. Started as is, it comes up with an
empty database, so copy the old volume across first:

```bash
docker compose down          # with the old compose file: stops trackr-app
git pull                     # or fetch the new docker-compose.yml
docker compose create        # creates tamam-app and an empty tamam_data volume
docker volume ls             # both volumes carry the Compose project name as a prefix
docker run --rm -v <project>_trackr_data:/from -v <project>_tamam_data:/to \
  alpine cp -a /from/. /to/
docker compose up -d
```

`<project>` is the Compose project name, by default the name of the directory
holding `docker-compose.yml`. Once Tamam is running with your data, remove the
old volume with `docker volume rm <project>_trackr_data`.

A `docker run` install only needs the image name changed to `tamam`; keep
passing your existing volume with `-v`.

## ⬆️ Webhook headers

Every delivery carries `X-Tamam-Event` and `X-Tamam-Delivery`, and the user
agent `Tamam-Webhook-Engine/1.0`. Webhook filters use TQL, Tamam's query
language.

## 🔒 Single Sign-On (OIDC)

SSO is **disabled until it is configured**, and a session is only ever created
from an ID token whose signature, issuer, audience, expiry and nonce all verify.

1. As an instance administrator, in **System Settings → Single sign-on**, set the issuer URL, the client id, and either
   the identity provider's X.509 signing certificate (for `RS256` tokens) or the
   client secret (for `HS256` tokens).
2. Register `https://<your-host>/api/v1/auth/sso/callback` as a redirect URI
   with your provider, using the `form_post` response mode.
3. Sign-in starts at `/api/v1/auth/sso/start`, which mints a nonce and state,
   discovers the provider's authorization endpoint, and redirects the browser.

The callback rejects any assertion that does not carry back the state and nonce
from a login attempt started on this instance.

An SSO login links to an existing account with the same email only when the
provider marks the address verified (`email_verified: true`). Providers that
never send the claim, such as Microsoft Entra ID, can be trusted with **Trust
unverified email addresses** in the SSO settings. New accounts are created
either way when automatic provisioning is on.

## 🧪 Tests & Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint; any warning fails
npm test            # vitest run
npm run build       # production build
npm run test:e2e    # accessibility checks against the build (needs `npx playwright install chromium` once)
```

CI runs all five on every push and pull request, and the release workflow will
not publish an image unless they pass. The accessibility checks start the
production build on a fresh database, walk through setup, and run
[axe](https://github.com/dequelabs/axe-core) on the setup, sign-in and Projects
pages, Home and Inbox, an issue's page and panel, the backlog and the board
(where a card is also moved with its menu, the keyboard and the mouse), and the
Issues page (its split view, table, views menu and TQL editor, while choosing
a view, adding a chip, running TQL and saving a view), the reports (each tab,
and a chart as a table), the roadmap, releases (creating a version, its issues
and its menu), every project and system settings section, including the
unsaved-changes bar, the status colour swatches and the dialogs they open
(including adding a member, after a second person signs up), the create-issue,
password, access-token, keyboard-shortcut and permissions dialogs, and a public
project seen by someone who isn't signed in. Every page must have exactly one
`h1`, dialogs opened with reduced motion must not animate, and every check runs
in the light theme and again in the dark one. A 390-pixel phone check confirms the tab bar, that the first board card shows
without scrolling, that nothing runs off the side of Home, and the issue's
property chips; any
serious or critical finding fails the build. The tests include a check that every
Tailwind class used under `src/` actually generates CSS, since Tailwind skips
unknown classes silently, and one that no HTML element uses a `title` attribute:
hints use the Tooltip component, which also shows on keyboard focus.

The favicon, home-screen and install icons are all drawn from `src/lib/logo.ts`.
After changing the logo, regenerate them with `npx tsx scripts/generate-icons.ts`;
a test fails if `src/app/icon.svg` no longer matches the drawing.

Bump the version with `npm version patch --no-git-tag-version` so
`package-lock.json` moves with `package.json`; CI fails when they differ.

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router) on React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS on design tokens (CSS variables in `src/app/globals.css`)
- **Type**: IBM Plex Sans and Plex Mono, served from Tamam's own origin
- **UI primitives**: `src/components/ui`, with behaviour from Radix UI
- **Icons**: Lucide React
- **Drag and Drop**: `@hello-pangea/dnd`
- **Database & ORM**: SQLite (`dev.db`) with Prisma ORM
- **Markdown**: `react-markdown` + `remark-gfm`
- **Dates**: `date-fns`
- **Tests**: Vitest and Testing Library; Playwright with axe-core for accessibility
