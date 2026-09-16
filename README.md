# Trackr

A modern, full-stack agile project management and issue tracking platform built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and **SQLite with Prisma ORM**.

---

## ✨ Features

- 📋 **Active Kanban Board**:
  - Drag-and-drop issues across columns (`To Do`, `In Progress`, `In Review`, `Done`).
  - Real-time column WIP limits & warning badges.
  - Immediate optimistic drag updates with persistent server synchronization.
- 🏃 **Agile Backlog & Sprint Management**:
  - Collapsible Sprints (Active, Future, and Backlog).
  - Sprint life-cycle: **Start Sprint** (with custom goal & duration) and **Complete Sprint** (with automatic rollover of open tasks).
  - Story point estimation tracking (total vs. completed points).
  - Inline quick-create directly in sprints or backlog.
- 🎯 **Issue Management**:
  - Issue types: **Epic**, **Story**, **Task**, **Bug**, **Sub-task**.
  - Priority levels: **Highest**, **High**, **Medium**, **Low**, **Lowest**.
  - Story points estimate badges.
  - Assignee & reporter assignment.
  - Parent Epic linking.
- 📝 **Issue Detail Modal**:
  - Inline editable title and rich description.
  - Status progression workflow dropdown.
  - Comments timeline with instant commenting and deletion.
  - Immutable activity history (logs who changed status, priority, or created issues).
- 🔍 **Interactive Filtering**:
  - Quick keyword search across issue keys and summaries.
  - One-click teammate avatar filter buttons.
  - "Only my issues" toggle.
  - Issue type & priority selectors.
- 🔐 **Authentication & Access Control**:
  - Email/password sign-in backed by a signed, http-only session cookie.
  - PBKDF2-SHA512 password hashing (210k iterations) with transparent upgrades.
  - Per-project roles (**Administrator**, **Member**, **Viewer**) enforced on the
    server, not just in the UI.
  - Optional OIDC single sign-on with real ID token signature verification.
  - Personal access tokens for the REST API, scoped to the owner's projects.
- ⚙️ **Project Settings**:
  - Configure project name, description, and review project lead details.

---

## 🚀 Quick Start

### 1. Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

You will be asked to sign in. After seeding, the demo accounts all share the
password **`trackr-demo`** (override at seed time with `TRACKR_SEED_PASSWORD`):

| Account | Email | Project role |
| --- | --- | --- |
| Alex Chen | `alex.chen@acme.dev` | Administrator (Apollo lead) |
| Sarah Connor | `sarah.c@acme.dev` | Member |
| David Kim | `david.k@acme.dev` | Member (Voyager lead) |
| Elena Rostova | `elena.r@acme.dev` | Member (Orion lead) |
| Marcus Vance | `marcus.v@acme.dev` | Viewer |

> **Change or remove these accounts before exposing an instance to anyone else.**

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
| `TRACKR_DATA_DIR` | `./data` | Where avatars and the generated session secret live. |
| `TRACKR_ALLOW_PRIVATE_WEBHOOKS` | `0` | Set to `1` to let webhooks target loopback, link-local and private addresses. Off by default so a webhook cannot be pointed at internal services. |
| `TRACKR_SEED_PASSWORD` | `trackr-demo` | Password given to the demo accounts by `db:seed`. |

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
Open [http://localhost:3000](http://localhost:3000). Data is automatically persisted in the `trackr_data` volume.

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
- **Dates**: `date-fns`
- **Tests**: Vitest
