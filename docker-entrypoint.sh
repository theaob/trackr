#!/bin/sh
set -e

# Ensure data directory exists
mkdir -p /app/data

# If database does not exist, copy from seeded template
if [ ! -f /app/data/dev.db ]; then
  echo "==> [Trackr] Initializing fresh database from template at /app/data/dev.db..."
  if [ -f /app/prisma/template.db ]; then
    cp /app/prisma/template.db /app/data/dev.db
  fi
fi

# Ensure schema is up to date
if [ -f ./node_modules/prisma/build/index.js ]; then
  echo "==> [Trackr] Synchronizing database schema..."
  node ./node_modules/prisma/build/index.js db push --skip-generate --schema=./prisma/schema.prisma || true
fi

echo "==> [Trackr] Server listening on port ${PORT:-3000}"
exec "$@"
