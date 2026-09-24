# syntax=docker/dockerfile:1

# 1. Base image – only runtime dependencies (shared by builder & runner)
FROM node:20-slim AS base
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends openssl sqlite3 ca-certificates gosu
WORKDIR /app

# 2. Dependencies – cached separately so source changes don't re-install
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit

# 3. Prisma generate – only re-runs when schema changes
FROM base AS prisma
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN node ./node_modules/prisma/build/index.js generate

# 4. Builder – full build with Next.js cache preserved across builds
FROM base AS builder
ARG GIT_COMMIT=""
ENV GIT_COMMIT=${GIT_COMMIT}
WORKDIR /app
COPY --from=prisma /app/node_modules ./node_modules
COPY . .

# Prepare two template databases: an empty one (schema only) that a fresh
# install boots from by default, sending people to /setup to create the real
# admin account, and a seeded one used only when TAMAM_SEED_DEMO=1 opts in.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/prisma/template.db"
RUN node ./node_modules/prisma/build/index.js db push --skip-generate

ENV DATABASE_URL="file:/app/prisma/template-demo.db"
RUN node ./node_modules/prisma/build/index.js db push --skip-generate
RUN node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts

# Build Next.js with persistent cache
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# 5. Production Runner – minimal final image
FROM base AS runner
ARG GIT_COMMIT=""
ENV GIT_COMMIT=${GIT_COMMIT}
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/dev.db"

# Create nextjs system user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 -g nodejs nextjs

# Set up data directories
RUN mkdir -p /app/data /app/prisma && \
    chown -R nextjs:nodejs /app/data /app/prisma

# Declare volume BEFORE switching user so Docker initializes it
# with the correct directory ownership (nextjs:nodejs)
VOLUME ["/app/data"]

# Copy standalone build and static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/build-info.json* ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma/template.db ./prisma/template.db
COPY --from=builder --chown=nextjs:nodejs /app/prisma/template-demo.db ./prisma/template-demo.db

# Copy Prisma CLI runtime files for startup schema sync
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Operator tooling. Plain CommonJS, so it runs with the node already in the
# image: docker exec -it tamam-app node scripts/set-password.cjs <email>
COPY --from=builder --chown=nextjs:nodejs /app/scripts/set-password.cjs ./scripts/set-password.cjs

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Entrypoint runs as root to fix volume permissions,
# then drops to nextjs via gosu

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
