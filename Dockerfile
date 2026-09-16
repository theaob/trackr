# syntax=docker/dockerfile:1

# 1. Base image
FROM node:20-slim AS base
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl sqlite3 ca-certificates && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app

# 2. Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit

# 3. Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client & prepare seeded template database
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/prisma/template.db"
RUN node ./node_modules/prisma/build/index.js generate
RUN node ./node_modules/prisma/build/index.js db push --skip-generate
RUN node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts

# Build Next.js standalone application
RUN npm run build

# 4. Production Runner
FROM base AS runner
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

# Copy standalone build and static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma/template.db ./prisma/template.db

# Copy Prisma CLI runtime files for startup schema sync
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

VOLUME ["/app/data"]

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
