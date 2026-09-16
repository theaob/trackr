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
- 👥 **Teammate Switcher**:
  - 1-click active session switching between team members (Alex Chen, Sarah Connor, David Kim, Elena Rostova, Marcus Vance) for effortless local testing.
- ⚙️ **Project Settings**:
  - Configure project name, description, and review project lead details.

---

## 🚀 Quick Start

### 1. Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Production Build
```bash
npm run build
npm start
```

### 3. Database Management
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

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Drag and Drop**: `@hello-pangea/dnd`
- **Database & ORM**: SQLite (`dev.db`) with Prisma ORM
- **Dates**: `date-fns`
