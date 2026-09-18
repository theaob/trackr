# Trackr

A modern, full-stack agile project management and issue tracking platform built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and **SQLite with Prisma ORM**.

---

## ✨ Features

- 📋 **Active Kanban Board**:
  - Drag-and-drop issues across columns (`To Do`, `In Progress`, `In Review`, `Done` by default).
  - Real-time column WIP limits & warning badges.
  - Immediate optimistic drag updates with persistent server synchronization.
- 🔁 **Custom Workflows, per project**:
  - Add, rename, reorder, recolor, or delete statuses; the board shows one column per
    non-backlog status, in the order you set.
  - Define exactly which status can move to which with a transition matrix, enforced
    everywhere a status can change (issue view, board drag-and-drop, the REST API) --
    not just hidden from a dropdown.
  - Every project starts with the same five statuses as before (`Backlog`, `To Do`,
    `In Progress`, `In Review`, `Done`), fully interconnected, so nothing changes until
    an administrator edits it in **Project Settings → Workflow**.
- 🔀 **Scrum or Kanban, per project**:
  - **Scrum**: plan sprints in the Backlog; the board shows only the active sprint.
  - **Kanban**: no sprints; the board is every issue pulled out of the Backlog, in
    continuous flow. Switch anytime from **Project Settings → General**.
- 🏃 **Agile Backlog & Sprint Management**:
  - Collapsible Sprints (Active, Future, and Backlog).
  - Sprint life-cycle: **Start Sprint** (with custom goal & duration) and **Complete Sprint** (with automatic rollover of open tasks).
  - Story point estimation tracking (total vs. completed points).
  - Inline quick-create directly in sprints or backlog.
- 📊 **Reports** (Scrum projects):
  - **Sprint Burndown**: story points remaining per day against an ideal guideline,
    reconstructed from each issue's actual status-change history.
  - **Velocity**: completed story points across recent finished sprints, with an
    average reference line.
  - **Status Breakdown**: where a sprint's issues currently stand, by workflow status.
- 🗺️ **Roadmap**: a timeline of your epics (Scrum or Kanban -- epics aren't
  sprint-bound), each bar spanning its start and due date with a progress fill
  drawn from its issues' completion. Epics missing either date are listed
  separately rather than silently dropped.
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
    status, assignee, or priority, add a label, or delete them all at once.
- 📝 **Issue Detail Modal**:
  - Inline editable title and rich description.
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
  - Comments timeline with instant commenting and deletion.
  - Immutable activity history (logs who changed status, priority, or created issues).
- 🔍 **Interactive Filtering**:
  - Quick keyword search across issue keys and summaries.
  - One-click teammate avatar filter buttons.
  - "Only my issues" toggle.
  - Issue type, priority & label selectors.
- 🔐 **Authentication & Access Control**:
  - Email/password sign-in backed by a signed, http-only session cookie.
  - PBKDF2-SHA512 password hashing (210k iterations) with transparent upgrades.
  - Per-project roles (**Administrator**, **Member**, **Viewer**) enforced on the
    server, not just in the UI.
  - Optional **public projects**: a project can grant read-only access to
    visitors with no account.
  - Optional OIDC single sign-on with real ID token signature verification.
  - Personal access tokens for the REST API, scoped to the owner's projects.
- ⚙️ **Project Settings**: General details, Custom Fields, Components, Webhooks,
  Access & Roles, Workflow, and SSO & Certificates, each its own tab.

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

The demo accounts all share the password **`trackr-demo`** (override at seed
time with `TRACKR_SEED_PASSWORD`):

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
| `TRACKR_DATA_DIR` | `./data` | Where avatars, issue attachments, and the generated session secret live. |
| `TRACKR_ALLOW_PRIVATE_WEBHOOKS` | `0` | Set to `1` to let webhooks target loopback, link-local and private addresses. Off by default so a webhook cannot be pointed at internal services. The bundled `/api/mock-webhook-receiver` is on localhost, so trying it out needs this set. |
| `TRACKR_TRUST_PROXY` | `0` | Set to `1` only when a reverse proxy in front of Trackr terminates HTTPS and forwards `X-Forwarded-Proto: https`. This marks the session cookie `Secure`, which browsers require for HTTPS but silently reject on plain HTTP from anywhere but `localhost`. Leave unset for a direct `http://` deployment (e.g. `docker run -p 3000:3000` with no proxy) — enabling it there breaks sign-in. |
| `TRACKR_SEED_PASSWORD` | `trackr-demo` | Password given to the demo accounts by `db:seed`. |
| `TRACKR_SEED_DEMO` | `0` | Docker only. Set to `1` to boot a fresh container from the seeded demo dataset instead of an empty database + setup wizard. Ignored once a database already exists. |

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
to create the admin account. Data is automatically persisted in the `trackr_data`
volume. Prefer the demo dataset instead? Set `TRACKR_SEED_DEMO=1` before the
first start (see the Configuration table above) — it only takes effect while
the database doesn't exist yet.

### Run with Docker CLI
```bash
# Build the image locally
docker build -t trackr:latest .

# Run the container with persistent storage
docker run -d -p 3000:3000 -v trackr_data:/app/data --name trackr-app trackr:latest
```

### Pull & Run from Docker Hub
```bash
docker run -d -p 3000:3000 -v trackr_data:/app/data --name trackr-app <DOCKERHUB_USERNAME>/trackr:latest
```

### Pull & Run from GitHub Container Registry (GHCR)
```bash
docker run -d -p 3000:3000 -v trackr_data:/app/data --name trackr-app ghcr.io/theaob/trackr:latest
```

---

## 🚀 Automated Releases & Docker Hub CI/CD

Whenever the version is bumped in `package.json` and pushed to `main` (or a `v*` tag is pushed), the GitHub Actions workflow ([`.github/workflows/release.yml`](.github/workflows/release.yml)) automatically:
1. Detects the new version and ensures it hasn't been released yet.
2. Creates a formal **GitHub Release** with auto-generated release notes and changelog.
3. Builds multi-architecture Docker images (`linux/amd64` and `linux/arm64`).
4. Pushes the versioned images to **Docker Hub** (`:latest`, `:<version>`, `:<major>.<minor>`) and **GHCR**.

### Required GitHub Secrets
To enable Docker Hub publishing, add the following secrets in GitHub (**Settings > Secrets and variables > Actions**):
- `DOCKERHUB_USERNAME`: Your Docker Hub username.
- `DOCKERHUB_TOKEN`: Your Docker Hub Personal Access Token.
- `DOCKERHUB_REPO` *(optional)*: Defaults to `<DOCKERHUB_USERNAME>/trackr`.

### Releasing a New Version
```bash
# Bump version (e.g. 0.1.0 -> 0.1.1 or 0.2.0)
npm version patch   # or minor / major

# Push commit to main (or push tags)
git push origin main
```

## 🌍 Public projects

A project can be opened to people without an account, one project at a time.
In **Project Settings → General → Visibility**, a project administrator ticks
*"Allow anyone to view this project without signing in"*.

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
npm run set-password -- alex.chen@acme.dev      # generate one, printed once
npm run set-password -- alex.chen@acme.dev 'a good password'
```

Or inside a running container:

```bash
docker exec -it trackr-app node scripts/set-password.cjs --list
docker exec -it trackr-app node scripts/set-password.cjs alex.chen@acme.dev
```

Re-seeding (`npm run db:seed`) also works, but it **deletes all existing
projects, issues and comments** — use it only on a throwaway database.

Two other changes are worth knowing about when upgrading:

- **Access is membership-driven.** Projects created before memberships existed
  are backfilled once with every user on first load, so nothing disappears, but
  newly registered accounts no longer join every project automatically.
- **Set `AUTH_SECRET`.** Without it, a secret is generated into the data
  directory; replacing that directory signs everyone out.

## 🔒 Single Sign-On (OIDC)

SSO is **disabled until it is configured**, and a session is only ever created
from an ID token whose signature, issuer, audience, expiry and nonce all verify.

1. In **Project Settings → SSO**, set the issuer URL, the client id, and either
   the identity provider's X.509 signing certificate (for `RS256` tokens) or the
   client secret (for `HS256` tokens).
2. Register `https://<your-host>/api/v1/auth/sso/callback` as a redirect URI
   with your provider, using the `form_post` response mode.
3. Sign-in starts at `/api/v1/auth/sso/start`, which mints a nonce and state,
   discovers the provider's authorization endpoint, and redirects the browser.

The callback rejects any assertion that does not carry back the state and nonce
from a login attempt started on this instance.

## 🧪 Tests & Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm test            # vitest run
npm run build       # production build
```

CI runs all four on every push and pull request, and the release workflow will
not publish an image unless they pass.

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Drag and Drop**: `@hello-pangea/dnd`
- **Database & ORM**: SQLite (`dev.db`) with Prisma ORM
- **Markdown**: `react-markdown` + `remark-gfm`
- **Dates**: `date-fns`
- **Tests**: Vitest
