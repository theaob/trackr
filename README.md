# Jira Software Clone

A full-stack, responsive Jira clone built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and **SQLite with Prisma ORM**.

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

### Pull & Run from GitHub Container Registry (GHCR)
```bash
docker run -d -p 3000:3000 -v trackr_data:/app/data --name trackr-app ghcr.io/theaob/trackr:latest
```

---

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Drag and Drop**: `@hello-pangea/dnd`
- **Database & ORM**: SQLite (`dev.db`) with Prisma ORM
- **Dates**: `date-fns`
